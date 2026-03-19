import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, SafeAreaView, Dimensions, ActivityIndicator, ScrollView, Alert, Animated, PanResponder, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import Button from '@/components/Button';
import PassengerCard, { PassengerStatus } from '@/components/PassengerCard';
import { LocationStore } from '@/services/LocationStore';
import { BoardingStore } from '@/services/BoardingStore';
import { SocketService } from '@/services/SocketService';
import { api } from '@/services/api';
import { AuthStore } from '@/services/AuthStore';
import { Route, Vehicle, ClusterEmployee } from '@/services/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.58;
const SHEET_MIN_HEIGHT = 90;
const SNAP_THRESHOLD = 50;

function toRad(value: number): number {
    return (value * Math.PI) / 180;
}

function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
    const R = 6371000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);

    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(meters: number): string {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
}

function bearingDegrees(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function normalizeDelta(deg: number): number {
    let d = deg;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
}

function classifyTurn(delta: number): { label: string; icon: keyof typeof Ionicons.glyphMap } {
    const absDelta = Math.abs(delta);
    if (absDelta < 25) return { label: 'Continue straight', icon: 'arrow-up' };
    if (absDelta >= 130) return { label: 'Make a U-turn', icon: 'return-up-back' };
    if (delta > 0) {
        if (absDelta >= 70) return { label: 'Turn right', icon: 'arrow-redo' };
        return { label: 'Keep right', icon: 'arrow-forward' };
    }
    if (absDelta >= 70) return { label: 'Turn left', icon: 'arrow-undo' };
    return { label: 'Keep left', icon: 'arrow-back' };
}

export default function DriverActiveNavigation() {
    const router = useRouter();
    const params = useLocalSearchParams<{ restartAt?: string }>();
    const [loading, setLoading] = useState(true);
    const [route, setRoute] = useState<Route | null>(null);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [passengers, setPassengers] = useState<ClusterEmployee[]>([]);
    const [currentStopIndex, setCurrentStopIndex] = useState(0);
    const [stopNames, setStopNames] = useState<Record<string, string>>({});
    const [passengerStatuses, setPassengerStatuses] = useState<Record<number, PassengerStatus>>({});
    const [tripStarted, setTripStarted] = useState(false);
    const [tripStartTime, setTripStartTime] = useState(new Date());
    const [expanded, setExpanded] = useState(true);
    const [shuttleIndex, setShuttleIndex] = useState(0);
    const [selfConfirmedIds, setSelfConfirmedIds] = useState<Set<number>>(new Set());
    const [socketConnected, setSocketConnected] = useState(false);
    const mapRef = useRef<MapView>(null);
    const sheetHeight = useRef(new Animated.Value(SHEET_MAX_HEIGHT)).current;
    const lastHeight = useRef(SHEET_MAX_HEIGHT);
    const handledRestartToken = useRef<string | null>(null);
    const autoFinishTriggered = useRef(false);

    const resetTripState = useCallback((): void => {
        setTripStarted(false);
        setTripStartTime(new Date());
        setShuttleIndex(0);
        setCurrentStopIndex(0);
        setExpanded(true);
        setSelfConfirmedIds(new Set());

        sheetHeight.setValue(SHEET_MAX_HEIGHT);
        lastHeight.current = SHEET_MAX_HEIGHT;
        BoardingStore.clear();
        LocationStore.clear();

        setPassengerStatuses((prev) => {
            const next = { ...prev };
            passengers.forEach((p) => {
                next[p.id] = 'Waiting';
            });
            return next;
        });
        autoFinishTriggered.current = false;
    }, [passengers, sheetHeight]);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
            onPanResponderMove: (_, gesture) => {
                const newHeight = lastHeight.current - gesture.dy;
                const clamped = Math.max(SHEET_MIN_HEIGHT, Math.min(SHEET_MAX_HEIGHT, newHeight));
                sheetHeight.setValue(clamped);
            },
            onPanResponderRelease: (_, gesture) => {
                const currentHeight = lastHeight.current - gesture.dy;
                const shouldExpand = gesture.dy < -SNAP_THRESHOLD || (currentHeight > (SHEET_MAX_HEIGHT + SHEET_MIN_HEIGHT) / 2 && gesture.dy >= -SNAP_THRESHOLD && gesture.dy <= SNAP_THRESHOLD);
                const target = shouldExpand ? SHEET_MAX_HEIGHT : SHEET_MIN_HEIGHT;
                Animated.spring(sheetHeight, { toValue: target, useNativeDriver: false, bounciness: 4, speed: 14 }).start();
                lastHeight.current = target;
                setExpanded(target === SHEET_MAX_HEIGHT);
            },
        })
    ).current;

    function toggleSheet() {
        const target = expanded ? SHEET_MIN_HEIGHT : SHEET_MAX_HEIGHT;
        Animated.spring(sheetHeight, { toValue: target, useNativeDriver: false, bounciness: 4, speed: 14 }).start();
        lastHeight.current = target;
        setExpanded(!expanded);
    }

    // Connect to Socket.IO and join route room
    useEffect(() => {
        SocketService.connect();
        const unsubConnection = SocketService.onConnectionChange((connected) => {
            setSocketConnected(connected);
        });
        return () => {
            unsubConnection();
        };
    }, []);

    // Listen for boarding updates from passengers via Socket.IO
    useEffect(() => {
        const unsubBoarding = SocketService.onBoardingChanged((data) => {
            const { employeeId, status } = data;
            if (status === 'confirmed') {
                setPassengerStatuses(prev => ({ ...prev, [employeeId]: 'Boarded' }));
                setSelfConfirmedIds(prev => new Set(prev).add(employeeId));
                // Also update local BoardingStore for trip summary
                BoardingStore.confirm(employeeId);
            } else if (status === 'declined') {
                setPassengerStatuses(prev => ({ ...prev, [employeeId]: 'Absent' }));
                setSelfConfirmedIds(prev => new Set(prev).add(employeeId));
                BoardingStore.decline(employeeId);
            }
        });
        return () => {
            unsubBoarding();
        };
    }, []);

    // Load initial data once. Trip state must persist when user leaves this screen.
    useEffect(() => {
        loadNavigationData();
    }, []);

    // Explicit restart flow (from trip summary button).
    useEffect(() => {
        const token = params.restartAt;
        if (!token || handledRestartToken.current === token) return;

        handledRestartToken.current = token;
        resetTripState();
        loadNavigationData();
    }, [params.restartAt, resetTripState]);

    // Convert route coordinates once
    const routeCoordinates = (route?.coordinates || []).map(c => ({
        latitude: c[0],
        longitude: c[1],
    }));

    const stops = route ? (route.bus_stops || route.stops) : [];
    const stopCoordinates = stops.map(s => ({
        latitude: s[0],
        longitude: s[1],
    }));

    // Simulate driving: advance along route coordinates (only after trip started)
    useEffect(() => {
        if (!tripStarted || routeCoordinates.length === 0) return;
        const interval = setInterval(() => {
            setShuttleIndex(prev => {
                if (prev >= routeCoordinates.length - 1) return prev;
                return prev + 1;
            });
        }, 100);
        return () => clearInterval(interval);
    }, [tripStarted, routeCoordinates.length]);

    // Auto-detect arrival at stops based on simulated position
    useEffect(() => {
        if (!tripStarted) return;
        if (routeCoordinates.length === 0 || stops.length === 0 || !route) return;
        const driverPos = routeCoordinates[shuttleIndex];
        if (!driverPos) return;

        // Find the nearest route coordinate index for the current stop
        const stop = stops[currentStopIndex];
        if (!stop) return;

        let nearestIdx = 0;
        let minDist = Infinity;
        for (let j = 0; j < routeCoordinates.length; j++) {
            const d = Math.abs(routeCoordinates[j].latitude - stop[0]) + Math.abs(routeCoordinates[j].longitude - stop[1]);
            if (d < minDist) { minDist = d; nearestIdx = j; }
        }

        // If shuttle has passed (or reached) this stop's nearest point
        if (shuttleIndex >= nearestIdx) {
            const isLastStop = currentStopIndex >= stops.length - 1;
            if (!isLastStop) {
                setCurrentStopIndex(prev => prev + 1);
            } else if (!autoFinishTriggered.current) {
                autoFinishTriggered.current = true;
                handleArrivedAtStop();
            }
        }
    }, [shuttleIndex]);

    // Publish location via Socket.IO + local LocationStore (only after trip started)
    useEffect(() => {
        if (!tripStarted || !route || routeCoordinates.length === 0) return;
        const pos = routeCoordinates[shuttleIndex] || routeCoordinates[0];
        // Local store (backward compat)
        LocationStore.update({
            latitude: pos.latitude,
            longitude: pos.longitude,
            currentStopIndex,
            totalStops: stops.length,
            tripActive: true,
            routeId: route.cluster_id,
        });
        // Broadcast to passengers via Socket.IO
        SocketService.sendLocationUpdate({
            routeId: route.cluster_id,
            latitude: pos.latitude,
            longitude: pos.longitude,
            currentStopIndex,
        });
    }, [tripStarted, shuttleIndex, currentStopIndex, route]);

    function handleStartTrip() {
        if (!route) return;
        const auth = AuthStore.get();
        const pos = routeCoordinates[0] || { latitude: 0, longitude: 0 };
        const dName = auth?.name || vehicle?.driver_name || route.driver_name || 'Driver';
        const vPlate = vehicle?.plate_number || route.vehicle_plate || 'N/A';

        // Start each trip with a clean boarding state.
        BoardingStore.clear();
        setPassengerStatuses((prev) => {
            const next = { ...prev };
            passengers.forEach((p) => {
                next[p.id] = 'Waiting';
            });
            return next;
        });
        setSelfConfirmedIds(new Set());

        // Join the route room and broadcast trip_start via Socket.IO
        SocketService.joinRoute(route.cluster_id, 'driver');
        SocketService.startTrip({
            routeId: route.cluster_id,
            latitude: pos.latitude,
            longitude: pos.longitude,
            totalStops: stops.length,
            driverName: dName,
            vehiclePlate: vPlate,
        });

        setTripStartTime(new Date());
        setTripStarted(true);
        autoFinishTriggered.current = false;
    }

    // Fallback: also poll BoardingStore locally (in case socket was slow)
    useEffect(() => {
        if (!tripStarted || passengers.length === 0) return;
        const interval = setInterval(() => {
            const allStatuses = BoardingStore.getAll();
            const newConfirmedIds = new Set(selfConfirmedIds);
            let changed = false;
            for (const p of passengers) {
                const boardingStatus = allStatuses[p.id];
                if (!boardingStatus) continue;
                if (boardingStatus === 'confirmed' && passengerStatuses[p.id] !== 'Boarded') {
                    setPassengerStatuses(prev => ({ ...prev, [p.id]: 'Boarded' }));
                    newConfirmedIds.add(p.id);
                    changed = true;
                } else if (boardingStatus === 'declined' && passengerStatuses[p.id] !== 'Absent') {
                    setPassengerStatuses(prev => ({ ...prev, [p.id]: 'Absent' }));
                    newConfirmedIds.add(p.id);
                    changed = true;
                }
            }
            if (changed) setSelfConfirmedIds(newConfirmedIds);
        }, 2000);
        return () => clearInterval(interval);
    }, [tripStarted, passengers, passengerStatuses, selfConfirmedIds]);

    async function loadNavigationData() {
        try {
            setLoading(true);
            const authUser = AuthStore.get();
            const clusterId = authUser?.routeClusterId;
            if (!clusterId) {
                console.warn('No assigned route cluster');
                return;
            }

            // Fetch the driver's own route, vehicle, and cluster in parallel
            const [myRoute, myVehicle, cluster] = await Promise.all([
                api.getRoute(clusterId),
                authUser?.vehicleId
                    ? api.getVehicle(authUser.vehicleId).catch(() => null)
                    : Promise.resolve(null),
                api.getCluster(clusterId),
            ]);

            setRoute(myRoute);
            if (myVehicle) setVehicle(myVehicle);

            if (cluster.employees) {
                setPassengers(cluster.employees);
                const statuses: Record<number, PassengerStatus> = {};
                cluster.employees.forEach(e => { statuses[e.id] = 'Waiting'; });
                setPassengerStatuses(statuses);
            }

            // Resolve stop names (non-blocking)
            const routeStops = myRoute.bus_stops || myRoute.stops;
            if (routeStops && routeStops.length > 0) {
                api.getStopNames(routeStops)
                    .then(names => setStopNames(names))
                    .catch(() => {});
            }
        } catch (err) {
            console.error('Failed to load navigation data:', err);
            Alert.alert('Connection Error', 'Could not load navigation data. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    }

    function getStopName(stop: number[]): string {
        const key = `${stop[0].toFixed(5)},${stop[1].toFixed(5)}`;
        return stopNames[key] || 'Bus Stop';
    }


    function handleArrivedAtStop() {
        if (!route) return;

        const isLastStop = currentStopIndex >= stops.length - 1;

        // Notify passengers that boarding check is starting at this stop (if not the last stop)
        const currentStop = stops[currentStopIndex];
        if (currentStop && !isLastStop) {
            SocketService.startBoardingCheck({
                routeId: route.cluster_id,
                stopIndex: currentStopIndex,
                stopName: getStopName(currentStop),
            });
        }

        if (isLastStop) {
            const boarded = Object.values(BoardingStore.getAll()).filter(s => s === 'confirmed').length;
            const absentCount = Object.values(BoardingStore.getAll()).filter(s => s === 'declined').length;
            const elapsed = Math.round((Date.now() - tripStartTime.getTime()) / 60000);

            // End trip via Socket.IO
            SocketService.endTrip(route.cluster_id);

            const currentLocation = LocationStore.get();
            if (currentLocation) {
                LocationStore.update({
                    ...currentLocation,
                    tripActive: false,
                });
            }

            const auth = AuthStore.get();
            const passengersData = passengers.map(p => ({
                employee_id: p.id,
                employee_name: p.name,
                boarding_status: passengerStatuses[p.id] === 'Boarded' ? 'confirmed' : passengerStatuses[p.id] === 'Absent' ? 'declined' : 'waiting',
            }));

            // Ensure navigation screen starts from a clean state when revisited.
            resetTripState();

            router.replace({
                pathname: '/(driver)/trip_summary',
                params: {
                    boarded: String(boarded),
                    absentCount: String(absentCount),
                    totalPassengers: String(passengers.length),
                    totalStops: String(stops.length),
                    distanceKm: String(route.distance_km),
                    durationMin: String(elapsed || Math.round(route.duration_min)),
                    routeId: String(route.cluster_id),
                    driverId: String(auth?.id || 0),
                    driverName: auth?.name || '',
                    vehicleId: String(vehicle?.id || auth?.vehicleId || 0),
                    vehiclePlate: vehicle?.plate_number || '',
                    startedAt: tripStartTime.toISOString(),
                    status: 'completed',
                    passengersJson: JSON.stringify(passengersData),
                },
            });
        } else {
            setCurrentStopIndex(currentStopIndex + 1);
        }
    }

    function handleTerminateTrip() {
        Alert.alert(
            'Terminate Trip',
            'Are you sure you want to end this trip early? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Terminate',
                    style: 'destructive',
                    onPress: () => {
                        if (!route) return;
                        const boarded = Object.values(BoardingStore.getAll()).filter(s => s === 'confirmed').length;
                        const absentCount = Object.values(BoardingStore.getAll()).filter(s => s === 'declined').length;
                        const elapsed = Math.round((Date.now() - tripStartTime.getTime()) / 60000);

                        // End trip via Socket.IO
                        SocketService.endTrip(route.cluster_id);

                        const currentLocation = LocationStore.get();
                        if (currentLocation) {
                            LocationStore.update({
                                ...currentLocation,
                                tripActive: false,
                            });
                        }

                        const auth = AuthStore.get();
                        const passengersData = passengers.map(p => ({
                            employee_id: p.id,
                            employee_name: p.name,
                            boarding_status: passengerStatuses[p.id] === 'Boarded' ? 'confirmed' : passengerStatuses[p.id] === 'Absent' ? 'declined' : 'waiting',
                        }));

                        // Ensure navigation screen starts from a clean state when revisited.
                        resetTripState();

                        router.replace({
                            pathname: '/(driver)/trip_summary',
                            params: {
                                boarded: String(boarded),
                                absentCount: String(absentCount),
                                totalPassengers: String(passengers.length),
                                totalStops: String(currentStopIndex + 1),
                                distanceKm: String(route.distance_km),
                                durationMin: String(elapsed || Math.round(route.duration_min)),
                                routeId: String(route.cluster_id),
                                driverId: String(auth?.id || 0),
                                driverName: auth?.name || '',
                                vehicleId: String(vehicle?.id || auth?.vehicleId || 0),
                                vehiclePlate: vehicle?.plate_number || '',
                                startedAt: tripStartTime.toISOString(),
                                status: 'terminated',
                                passengersJson: JSON.stringify(passengersData),
                            },
                        });
                    },
                },
            ]
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ marginTop: 12, color: Colors.textSecondary }}>Loading navigation...</Text>
            </SafeAreaView>
        );
    }

    if (!route || routeCoordinates.length === 0) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <Ionicons name="navigate-circle-outline" size={48} color={Colors.textMuted} />
                <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 16 }}>No Route Data</Text>
            </SafeAreaView>
        );
    }

    const shuttleLocation = routeCoordinates[shuttleIndex] || routeCoordinates[0];
    const currentStop = stops[currentStopIndex];
    const nextStopName = currentStop ? getStopName(currentStop) : 'End';
    const isLastStop = currentStopIndex >= stops.length - 1;

    // Dynamic ETA based on simulation progress
    const progress = routeCoordinates.length > 1 ? shuttleIndex / (routeCoordinates.length - 1) : 0;
    const tripFinished = progress >= 1;
    const remainingFraction = 1 - progress;
    const minutesAway = Math.max(1, Math.round(route.duration_min * remainingFraction));

    const now = new Date();
    const arrivalDate = new Date(now.getTime() + minutesAway * 60 * 1000);
    const arrivalTime = `${String(arrivalDate.getHours()).padStart(2, '0')}:${String(arrivalDate.getMinutes()).padStart(2, '0')}`;

    const auth = AuthStore.get();
    const driverName = auth?.name || vehicle?.driver_name || route.driver_name || 'Driver';
    const vehiclePlate = vehicle?.plate_number || route.vehicle_plate || 'N/A';

    // Center map on route
    const mapRegion = {
        latitude: shuttleLocation.latitude,
        longitude: shuttleLocation.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
    };

    // Passenger stats
    const boardedCount = Object.values(passengerStatuses).filter(s => s === 'Boarded').length;
    const absentCount = Object.values(passengerStatuses).filter(s => s === 'Absent').length;
    const waitingCount = passengers.length - boardedCount - absentCount;

    const navigationSteps = (() => {
        if (routeCoordinates.length === 0 || stops.length === 0) return [] as { stopName: string; distanceMeters: number; stopIndex: number }[];

        const nearestRouteIndex = (coord: { latitude: number; longitude: number }): number => {
            let nearestIdx = 0;
            let nearestDist = Infinity;
            for (let i = 0; i < routeCoordinates.length; i++) {
                const d = Math.abs(routeCoordinates[i].latitude - coord.latitude) + Math.abs(routeCoordinates[i].longitude - coord.longitude);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestIdx = i;
                }
            }
            return nearestIdx;
        };

        const polylineDistance = (startIdx: number, endIdx: number): number => {
            if (endIdx <= startIdx) return 0;
            let total = 0;
            for (let i = startIdx; i < endIdx; i++) {
                total += haversineMeters(routeCoordinates[i], routeCoordinates[i + 1]);
            }
            return total;
        };

        const currentIdx = Math.min(shuttleIndex, routeCoordinates.length - 1);
        const upcoming: { stopName: string; distanceMeters: number; stopIndex: number }[] = [];

        for (let i = currentStopIndex; i < stops.length && upcoming.length < 3; i++) {
            const stop = stops[i];
            const stopCoord = { latitude: stop[0], longitude: stop[1] };
            const stopIdx = nearestRouteIndex(stopCoord);
            const distanceOnRoute = polylineDistance(currentIdx, stopIdx);
            const fallbackDirect = haversineMeters(routeCoordinates[currentIdx], stopCoord);
            const distanceMeters = distanceOnRoute > 0 ? distanceOnRoute : fallbackDirect;

            upcoming.push({
                stopName: getStopName(stop),
                distanceMeters,
                stopIndex: i,
            });
        }

        return upcoming;
    })();

    const upcomingManeuvers = (() => {
        if (routeCoordinates.length < 3) return [] as { label: string; distanceMeters: number; icon: keyof typeof Ionicons.glyphMap }[];

        const currentIdx = Math.min(shuttleIndex, routeCoordinates.length - 2);
        const maneuvers: { label: string; distanceMeters: number; icon: keyof typeof Ionicons.glyphMap }[] = [];
        let distanceFromCurrent = 0;
        let distanceSinceLastManeuver = 0;

        for (let i = currentIdx + 1; i < routeCoordinates.length - 1 && maneuvers.length < 3; i++) {
            const prev = routeCoordinates[i - 1];
            const curr = routeCoordinates[i];
            const next = routeCoordinates[i + 1];

            const segDist = haversineMeters(prev, curr);
            distanceFromCurrent += segDist;
            distanceSinceLastManeuver += segDist;

            const incoming = bearingDegrees(prev, curr);
            const outgoing = bearingDegrees(curr, next);
            const delta = normalizeDelta(outgoing - incoming);
            const absDelta = Math.abs(delta);

            // Filter tiny geometry wiggles; keep only meaningful maneuvers.
            if (absDelta < 30 || distanceSinceLastManeuver < 120) {
                continue;
            }

            const turn = classifyTurn(delta);
            maneuvers.push({
                label: turn.label,
                distanceMeters: distanceFromCurrent,
                icon: turn.icon,
            });
            distanceSinceLastManeuver = 0;
        }

        if (maneuvers.length === 0 && navigationSteps[0]) {
            maneuvers.push({
                label: `Continue to ${navigationSteps[0].stopName}`,
                distanceMeters: navigationSteps[0].distanceMeters,
                icon: 'navigate',
            });
        }

        return maneuvers;
    })();

    const nextStopDistanceLabel = navigationSteps[0] ? formatDistance(navigationSteps[0].distanceMeters) : '0 m';

    const mergedGuidance = (() => {
        const items: { type: 'maneuver' | 'stop'; label: string; distance: number; icon: keyof typeof Ionicons.glyphMap; subtitle?: string }[] = [];

        if (upcomingManeuvers.length > 0) {
            upcomingManeuvers.forEach((m) => {
                items.push({
                    type: 'maneuver',
                    label: m.label,
                    distance: m.distanceMeters,
                    icon: m.icon,
                });
            });
        }

        if (navigationSteps.length > 0) {
            navigationSteps.forEach((step) => {
                items.push({
                    type: 'stop',
                    label: step.stopName,
                    distance: step.distanceMeters,
                    icon: 'location',
                    subtitle: `Stop ${step.stopIndex + 1}`,
                });
            });
        }

        items.sort((a, b) => a.distance - b.distance);
        return items;
    })();

    // Google Maps Navigator style: next instruction card
    const nextInstruction = mergedGuidance[0];
    const distanceToDestMs = navigationSteps[navigationSteps.length - 1]?.distanceMeters || route?.distance_km * 1000 || 0;
    // Progress bar should reflect route completion from start (0%) to destination (100%).
    const progressFraction = Math.max(0, Math.min(1, progress));

    return (
        <View style={{ flex: 1 }}>
            {/* Full-screen Map */}
            <MapView
                ref={mapRef}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                initialRegion={mapRegion}
                showsUserLocation
                showsMyLocationButton={false}
            >
                <Polyline
                    coordinates={routeCoordinates}
                    strokeColor={Colors.primary}
                    strokeWidth={4}
                />
                {stopCoordinates.map((coord, index) => {
                    const passed = (() => {
                        let nearestIdx = 0;
                        let minDist = Infinity;
                        for (let j = 0; j < routeCoordinates.length; j++) {
                            const d = Math.abs(routeCoordinates[j].latitude - coord.latitude) + Math.abs(routeCoordinates[j].longitude - coord.longitude);
                            if (d < minDist) { minDist = d; nearestIdx = j; }
                        }
                        return shuttleIndex > nearestIdx;
                    })();
                    return (
                        <Marker key={index} coordinate={coord}>
                            <View
                                style={{
                                    width: index === currentStopIndex ? 14 : 12,
                                    height: index === currentStopIndex ? 14 : 12,
                                    borderRadius: 7,
                                    backgroundColor: passed ? Colors.primary : Colors.white,
                                    borderWidth: 2,
                                    borderColor: Colors.primary,
                                }}
                            />
                        </Marker>
                    );
                })}
                {/* Driver marker */}
                <Marker coordinate={shuttleLocation}>
                    <View style={{ alignItems: 'center' }}>
                        <View style={{
                            backgroundColor: Colors.primary,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            marginBottom: 4,
                        }}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                                {vehiclePlate}
                            </Text>
                        </View>
                        <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: Colors.white,
                            borderWidth: 3,
                            borderColor: Colors.primary,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Ionicons name="bus" size={20} color={Colors.primary} />
                        </View>
                    </View>
                </Marker>
            </MapView>

            {/* Google Maps Navigator Style - Next Instruction Card */}
            {nextInstruction && (
                <View
                    style={{
                        position: 'absolute',
                        top: 60,
                        left: 16,
                        right: 16,
                        backgroundColor: Colors.white,
                        borderRadius: 16,
                        padding: 16,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 12,
                        elevation: 8,
                    }}
                >
                    {/* Top Row: Turn Icon + Primary Instruction */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View
                            style={{
                                width: 60,
                                height: 60,
                                borderRadius: 12,
                                backgroundColor: Colors.primaryLight,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 12,
                            }}
                        >
                            <Ionicons name={nextInstruction.icon} size={32} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text }}>
                                {`In ${formatDistance(nextInstruction.distance)}`}
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginTop: 2 }}>
                                {nextInstruction.label}
                            </Text>
                        </View>
                    </View>

                    {/* Bottom Row: Destination + ETA */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, color: Colors.textSecondary, fontWeight: '600' }}>
                                {nextStopName}
                            </Text>
                            <Text style={{ fontSize: 13, color: Colors.text, fontWeight: '700', marginTop: 2 }}>
                                {formatDistance(distanceToDestMs)}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 12, color: Colors.textSecondary, fontWeight: '600' }}>
                                Arrival
                            </Text>
                            <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '700', marginTop: 2 }}>
                                {arrivalTime}
                            </Text>
                        </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={{ marginTop: 10, height: 3, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' }}>
                        <View
                            style={{
                                height: '100%',
                                width: `${Math.max(0, Math.min(100, progressFraction * 100))}%`,
                                backgroundColor: Colors.primary,
                            }}
                        />
                    </View>
                </View>
            )}

            {/* Top-right: Live Indicator + Trip Stats Compact */}
            <View style={{ position: 'absolute', top: 60, right: 16, gap: 8 }}>
                {tripStarted && (
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: socketConnected ? '#22C55E' : '#EF4444',
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            gap: 6,
                        }}
                    >
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                            {socketConnected ? 'LIVE' : 'OFFLINE'}
                        </Text>
                    </View>
                )}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={{ backgroundColor: Colors.white, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary }}>
                            {boardedCount}/{passengers.length}
                        </Text>
                    </View>
                </View>
            </View>


            {/* Draggable Bottom Sheet */}
            <Animated.View
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: sheetHeight,
                    backgroundColor: Colors.white,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    elevation: 10,
                    overflow: 'hidden',
                }}
            >
                {/* Drag Handle */}
                <View {...panResponder.panHandlers}>
                    <TouchableOpacity
                        onPress={toggleSheet}
                        activeOpacity={0.8}
                        style={{ paddingTop: 12, paddingBottom: 8, alignItems: 'center' }}
                    >
                        <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: Colors.border }} />
                    </TouchableOpacity>
                </View>

                {/* Sheet Content */}
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Boarding Stats Bar */}
                    <View style={{
                        flexDirection: 'row',
                        gap: 12,
                        marginBottom: 12,
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        backgroundColor: Colors.background,
                        borderRadius: 10,
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary }} />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text }}>
                                {boardedCount} Boarded
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border }} />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text }}>
                                {waitingCount} Waiting
                            </Text>
                        </View>
                        {absentCount > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                                <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text }}>
                                    {absentCount} Absent
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Start Trip / Trip Complete buttons */}
                    {!tripStarted ? (
                        <View>
                            <Button
                                title="Start Trip"
                                onPress={handleStartTrip}
                                icon="play-circle-outline"
                            />
                        </View>
                    ) : isLastStop ? (
                        <View style={{ paddingTop: 16, gap: 10 }}>
                            <Button
                                title={`Trip Complete · ${boardedCount}/${passengers.length} Boarded`}
                                onPress={handleArrivedAtStop}
                                icon="checkmark-circle-outline"
                            />
                        </View>
                    ) : (
                        <View style={{ paddingTop: 16 }}>
                            <Button
                                title="Terminate Trip"
                                onPress={handleTerminateTrip}
                                icon="close-circle-outline"
                                variant="outline"
                            />
                        </View>
                    )}

                    {/* Passenger List (read-only, auto-updated via self-check-in) */}
                    <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, paddingTop: 16 }}>
                        Passengers
                    </Text>
                    {passengers.map((passenger) => (
                        <PassengerCard
                            key={passenger.id}
                            name={passenger.name}
                            status={passengerStatuses[passenger.id] || 'Waiting'}
                            avatar={`https://i.pravatar.cc/100?u=${passenger.id}`}
                            stopName={passenger.pickup_point ? getStopName(passenger.pickup_point) : 'Unknown Stop'}
                            selfConfirmed={selfConfirmedIds.has(passenger.id)}
                        />
                    ))}
                </ScrollView>
            </Animated.View>
        </View>
    );
}
