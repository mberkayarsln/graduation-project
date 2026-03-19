import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, Dimensions, TouchableOpacity, Animated, PanResponder, ScrollView, RefreshControl, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import Button from '@/components/Button';
import SideMenu from '@/components/SideMenu';
import { api } from '@/services/api';
import { AuthStore } from '@/services/AuthStore';
import { LocationStore } from '@/services/LocationStore';
import { NotificationService } from '@/services/NotificationService';
import { SocketService } from '@/services/SocketService';
import { Route, Vehicle, StopNamesMap } from '@/services/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const SHEET_MIN_HEIGHT = 80;
const SNAP_THRESHOLD = 50;

const ISTANBUL_REGION = {
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
};

export default function EmployeeHome() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [route, setRoute] = useState<Route | null>(null);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [expanded, setExpanded] = useState(true);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [assignedStop, setAssignedStop] = useState<{ latitude: number; longitude: number } | null>(null);
    const [pickupStopName, setPickupStopName] = useState<string>('');
    const [walkingRoute, setWalkingRoute] = useState<{ latitude: number; longitude: number }[]>([]);
    const [walkingDistance, setWalkingDistance] = useState<number | null>(null);
    const [walkingDuration, setWalkingDuration] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [locationInView, setLocationInView] = useState(false);
    const [employeeName, setEmployeeName] = useState('');
    const [menuVisible, setMenuVisible] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [routeActive, setRouteActive] = useState(false);

    const sheetHeight = useRef(new Animated.Value(SHEET_MAX_HEIGHT)).current;
    const lastHeight = useRef(SHEET_MAX_HEIGHT);
    const mapRef = useRef<MapView>(null);

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
                Animated.spring(sheetHeight, {
                    toValue: target,
                    useNativeDriver: false,
                    bounciness: 4,
                    speed: 14,
                }).start();
                lastHeight.current = target;
                setExpanded(target === SHEET_MAX_HEIGHT);
            },
        })
    ).current;

    function toggleSheet() {
        const target = expanded ? SHEET_MIN_HEIGHT : SHEET_MAX_HEIGHT;
        Animated.spring(sheetHeight, {
            toValue: target,
            useNativeDriver: false,
            bounciness: 4,
            speed: 14,
        }).start();
        lastHeight.current = target;
        setExpanded(!expanded);
    }

    function refreshRouteActivity() {
        const authUser = AuthStore.get();
        const myClusterId = authUser?.role === 'employee' ? authUser.clusterId ?? null : null;
        const driverLocation = LocationStore.get();
        const isMyRouteActive = !!driverLocation?.tripActive && (myClusterId == null || driverLocation.routeId === myClusterId);
        setRouteActive(isMyRouteActive);
    }

    useEffect(() => {
        NotificationService.init().then(ok => setNotificationsEnabled(ok));
        refreshRouteActivity();
        const interval = setInterval(refreshRouteActivity, 3000);
        loadData();

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const authUser = AuthStore.get();
        if (!authUser || authUser.role !== 'employee' || authUser.clusterId == null) return;

        const myClusterId = authUser.clusterId;

        const unsubTripStarted = SocketService.onTripStarted((data) => {
            if (data.routeId !== myClusterId) return;
            setRouteActive(true);
        });

        const unsubTripUpdate = SocketService.onTripUpdate((data) => {
            if (data.routeId !== myClusterId) return;
            setRouteActive(!!data.tripActive);
        });

        const unsubTripEnded = SocketService.onTripEnded((data) => {
            if (data.routeId !== myClusterId) return;
            setRouteActive(false);
        });

        return () => {
            unsubTripStarted();
            unsubTripUpdate();
            unsubTripEnded();
        };
    }, []);

    async function loadData() {
        try {
            // Use the logged-in employee's data from AuthStore
            const authUser = AuthStore.get();
            if (!authUser || authUser.role !== 'employee') return;

            setEmployeeName(authUser.name);

            // Home location
            if (authUser.lat != null && authUser.lon != null) {
                const coords = { latitude: authUser.lat, longitude: authUser.lon };
                setUserLocation(coords);
                mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 1000);
            }

            // Assigned pickup stop
            if (authUser.pickupPoint) {
                setAssignedStop({
                    latitude: authUser.pickupPoint[0],
                    longitude: authUser.pickupPoint[1],
                });
            }

            // Fetch only the routes + vehicles in parallel (no full employee list needed)
            const [routes, vehicles] = await Promise.all([
                api.getRoutes(),
                api.getVehicles(),
            ]);

            // Match route strictly to this employee's assigned cluster
            const matchingRoute = authUser.clusterId != null
                ? routes.find(r => r.cluster_id === authUser.clusterId) ?? null
                : null;
            setRoute(matchingRoute);

            // Match vehicle to the selected route's vehicle_id
            if (matchingRoute?.vehicle_id != null) {
                const matchingVehicle = vehicles.find(v => v.id === matchingRoute.vehicle_id) ?? null;
                setVehicle(matchingVehicle);
            } else {
                setVehicle(null);
            }

            // Fetch pickup stop name
            if (authUser.pickupPoint) {
                try {
                    const names = await api.getStopNames([[authUser.pickupPoint[0], authUser.pickupPoint[1]]]);
                    const key = `${authUser.pickupPoint[0].toFixed(5)},${authUser.pickupPoint[1].toFixed(5)}`;
                    setPickupStopName(names[key] || 'Bus Stop');
                } catch {
                    console.warn('Could not resolve stop name');
                }

                // Walking distance via OSRM
                if (authUser.lat != null && authUser.lon != null) {
                    try {
                        const walkData = await api.getWalkingRoute(
                            authUser.lat, authUser.lon,
                            authUser.pickupPoint[0], authUser.pickupPoint[1]
                        );
                        if (walkData.coordinates) {
                            setWalkingRoute(
                                walkData.coordinates.map((c: number[]) => ({ latitude: c[0], longitude: c[1] }))
                            );
                        }
                        setWalkingDistance(Math.round(walkData.distance_km * 1000));
                        setWalkingDuration(Math.round(walkData.duration_min));
                    } catch {
                        console.warn('Could not fetch walking route');
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load data:', err);
            Alert.alert('Connection Error', 'Could not load shuttle information. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    }

    function goToMyLocation() {
        if (!userLocation) return;
        mapRef.current?.animateToRegion({
            ...userLocation,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        }, 800);
        setLocationInView(true);
        if (expanded) {
            Animated.spring(sheetHeight, {
                toValue: SHEET_MIN_HEIGHT,
                useNativeDriver: false,
                bounciness: 4,
                speed: 14,
            }).start();
            lastHeight.current = SHEET_MIN_HEIGHT;
            setExpanded(false);
        }
    }

    // Greeting based on time of day
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    return (
        <View style={{ flex: 1 }}>
            {/* Map — fullscreen */}
            <MapView
                ref={mapRef}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                initialRegion={ISTANBUL_REGION}
                showsUserLocation
                showsMyLocationButton={false}
                onPanDrag={() => setLocationInView(false)}
            >
                {userLocation && (
                    <Marker coordinate={userLocation} title="You are here">
                        <View style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: Colors.primary,
                            borderWidth: 3,
                            borderColor: Colors.white,
                        }} />
                    </Marker>
                )}
                {assignedStop && (
                    <Marker coordinate={assignedStop} title={pickupStopName || 'Your Pickup Stop'}>
                        <View style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: Colors.primary,
                            borderWidth: 2,
                            borderColor: Colors.white,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Ionicons name="flag" size={12} color={Colors.white} />
                        </View>
                    </Marker>
                )}
                {/* Walking path line — real OSRM route or straight-line fallback */}
                {walkingRoute.length > 0 ? (
                    <Polyline
                        coordinates={walkingRoute}
                        strokeColor="#64B5F6"
                        strokeWidth={3}
                        lineDashPattern={[4, 6]}
                    />
                ) : userLocation && assignedStop ? (
                    <Polyline
                        coordinates={[userLocation, assignedStop]}
                        strokeColor="#4A90D9"
                        strokeWidth={2}
                        lineDashPattern={[4, 6]}
                    />
                ) : null}
            </MapView>

            {/* Header Overlay */}
            <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 }}>
                    <TouchableOpacity
                        onPress={() => setMenuVisible(true)}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Ionicons name="menu-outline" size={22} color={Colors.text} />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity
                            onPress={() => router.push('/(employee)/notifications')}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: 'rgba(255,255,255,0.9)',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Ionicons name={notificationsEnabled ? 'notifications' : 'notifications-outline'} size={22} color={notificationsEnabled ? Colors.primary : Colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={goToMyLocation}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: 'rgba(255,255,255,0.9)',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Ionicons name="locate" size={20} color={locationInView ? Colors.primary : Colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>

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
                        <View
                            style={{
                                width: 36,
                                height: 5,
                                borderRadius: 3,
                                backgroundColor: Colors.border,
                            }}
                        />
                    </TouchableOpacity>
                </View>

                {/* Sheet Content */}
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={async () => {
                                setRefreshing(true);
                                await loadData();
                                setRefreshing(false);
                            }}
                            tintColor={Colors.primary}
                        />
                    }
                >
                    {/* Greeting */}
                    <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.text }}>
                        {greeting}{employeeName ? `, ${employeeName.split(' ')[0]}` : ''} 👋
                    </Text>
                    <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: 20 }}>
                        {
                            loading
                                ? 'Loading your shuttle info...'
                                : !route
                                    ? 'No shuttle assigned yet'
                                    : routeActive
                                        ? 'Your shuttle is currently active on route'
                                        : 'Your shuttle is ready'
                        }
                    </Text>

                    {/* Pickup Stop Card */}
                    {pickupStopName ? (
                        <View style={{
                            backgroundColor: Colors.primaryLight,
                            borderRadius: 14,
                            padding: 16,
                            marginBottom: 14,
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                <View style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: Colors.primary,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 12,
                                }}>
                                    <Ionicons name="flag" size={16} color={Colors.white} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Your Pickup Stop
                                    </Text>
                                    <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 2 }}>
                                        {pickupStopName}
                                    </Text>
                                </View>
                            </View>
                            {walkingDistance !== null && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(76,175,80,0.2)' }}>
                                    <Ionicons name="walk" size={18} color={Colors.primary} />
                                    <Text style={{ fontSize: 14, color: Colors.primary, fontWeight: '600', marginLeft: 8 }}>
                                        {walkingDistance}m · {walkingDuration} min walk
                                    </Text>
                                </View>
                            )}
                        </View>
                    ) : null}

                    {/* Route Info Card */}
                    {route && (
                        <View style={{
                            backgroundColor: Colors.background,
                            borderRadius: 14,
                            padding: 16,
                            marginBottom: 14,
                        }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                                Your Route
                            </Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <View style={{ alignItems: 'center', flex: 1 }}>
                                    <Ionicons name="people" size={20} color={Colors.primary} />
                                    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 4 }}>
                                        {route.employee_count}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                                        Passengers
                                    </Text>
                                </View>
                                <View style={{ width: 1, backgroundColor: Colors.borderLight }} />
                                <View style={{ alignItems: 'center', flex: 1 }}>
                                    <Ionicons name="navigate" size={20} color={Colors.primary} />
                                    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 4 }}>
                                        {Number(route.distance_km).toFixed(1)}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                                        km Total
                                    </Text>
                                </View>
                                <View style={{ width: 1, backgroundColor: Colors.borderLight }} />
                                <View style={{ alignItems: 'center', flex: 1 }}>
                                    <Ionicons name="location" size={20} color={Colors.primary} />
                                    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 4 }}>
                                        {(route.bus_stops || route.stops).length}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                                        Stops
                                    </Text>
                                </View>
                                <View style={{ width: 1, backgroundColor: Colors.borderLight }} />
                                <View style={{ alignItems: 'center', flex: 1 }}>
                                    <Ionicons name="time" size={20} color={Colors.primary} />
                                    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 4 }}>
                                        {Math.round(route.duration_min)}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                                        min ETA
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Vehicle & Driver Card */}
                    {vehicle && (
                        <View style={{
                            backgroundColor: Colors.background,
                            borderRadius: 14,
                            padding: 16,
                            marginBottom: 20,
                        }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                                Assigned Vehicle
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 22,
                                    backgroundColor: Colors.primaryLight,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 14,
                                }}>
                                    <Ionicons name="bus" size={22} color={Colors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text }}>
                                        {vehicle.driver_name || 'Unknown Driver'} - {vehicle.plate_number || 'N/A'}
                                    </Text>
                                    <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>
                                        {vehicle.vehicle_type} · {vehicle.capacity} seats
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Track Shuttle Button */}
                    <Button
                        title="Track My Shuttle"
                        onPress={() => router.push('/(employee)/tracking')}
                        icon="bus-outline"
                    />
                </ScrollView>
            </Animated.View>
            {/* Side Menu */}
            <SideMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                userName={employeeName}
                userEmail={employeeName ? `${employeeName.toLowerCase().replace(/\s+/g, '.')}@company.com` : undefined}
                items={[
                    { icon: 'person-outline', label: 'My Profile', onPress: () => router.push('/(employee)/profile') },
                    { icon: 'time-outline', label: 'Route History', onPress: () => router.push('/(employee)/history'), dividerAfter: true },
                    { icon: 'log-out-outline', label: 'Logout', onPress: () => { AuthStore.clear(); LocationStore.clear(); router.replace('/'); } },
                ]}
            />
        </View>
    );
}
