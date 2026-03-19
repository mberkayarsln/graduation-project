import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

import SideMenu from '@/components/SideMenu';
import { LocationStore } from '@/services/LocationStore';
import { api } from '@/services/api';
import { AuthStore } from '@/services/AuthStore';
import { Route, Vehicle } from '@/services/types';

export default function DriverRouteOverview() {
    const router = useRouter();
    const authUser = AuthStore.get();

    const [loading, setLoading] = useState(true);
    const [route, setRoute] = useState<Route | null>(null);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [stopNames, setStopNames] = useState<Record<string, string>>({});
    const [menuVisible, setMenuVisible] = useState(false);


    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const authUser = AuthStore.get();

            const [routes, vehicles] = await Promise.all([
                api.getRoutes(),
                api.getVehicles(),
            ]);

            // Scope route to the driver's assigned cluster
            const myRoute =
                (authUser?.routeClusterId != null
                    ? routes.find(r => r.cluster_id === authUser.routeClusterId)
                    : undefined) ??
                routes[0] ??
                null;

            if (myRoute) {
                setRoute(myRoute);
                const stops = myRoute.bus_stops || myRoute.stops || [];
                if (stops.length > 0) {
                    try {
                        const names = await api.getStopNames(stops);
                        setStopNames(names);
                    } catch { /* Stop names are optional */ }
                }
            }

            // Scope vehicle to the driver's assigned vehicle
            const myVehicle =
                (authUser?.vehicleId != null
                    ? vehicles.find(v => v.id === authUser.vehicleId)
                    : undefined) ??
                vehicles[0] ??
                null;
            if (myVehicle) setVehicle(myVehicle);
        } catch (err) {
            console.error('Failed to load route data:', err);
            Alert.alert('Connection Error', 'Could not load route data. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    }

    function getStopName(stop: number[], index: number): string {
        const key = `${stop[0].toFixed(5)},${stop[1].toFixed(5)}`;
        return stopNames[key] || `Stop ${index + 1}`;
    }

    function formatTime(index: number, totalStops: number): string {
        // Estimate times based on duration_min spread across stops
        if (!route) return '--:--';
        const startHour = 7;
        const startMin = 30;
        const intervalMin = totalStops > 1 ? route.duration_min / (totalStops - 1) : 0;
        const totalMin = startMin + index * intervalMin;
        const hour = startHour + Math.floor(totalMin / 60);
        const min = Math.round(totalMin % 60);
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour;
        return `${String(displayHour).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`;
    }

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ marginTop: 12, color: Colors.textSecondary }}>Loading route...</Text>
            </SafeAreaView>
        );
    }

    if (!route) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
                <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 16 }}>No Route Assigned</Text>
                <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                    There are no routes available. Please contact dispatch.
                </Text>
            </SafeAreaView>
        );
    }

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
            {/* Header */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    backgroundColor: Colors.white,
                    borderBottomWidth: 1,
                    borderBottomColor: Colors.borderLight,
                }}
            >
                <TouchableOpacity onPress={() => setMenuVisible(true)}>
                    <Ionicons name="menu-outline" size={26} color={Colors.text} />
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.text }}>My Route</Text>
                <TouchableOpacity>
                    <Ionicons name="notifications-outline" size={24} color={Colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Shift Info Card */}
                <View
                    style={{
                        backgroundColor: Colors.white,
                        borderRadius: 16,
                        padding: 20,
                        marginBottom: 16,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 3,
                    }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                        <View>
                            <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Shift Date</Text>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 2 }}>
                                {dateStr}
                            </Text>
                        </View>
                        <View
                            style={{
                                backgroundColor: Colors.primaryLight,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 8,
                                alignSelf: 'flex-start',
                            }}
                        >
                            <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>
                                Route {route.cluster_id}
                            </Text>
                        </View>
                    </View>

                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingTop: 16,
                            borderTopWidth: 1,
                            borderTopColor: Colors.borderLight,
                        }}
                    >
                        <Ionicons name="bus-outline" size={20} color={Colors.textSecondary} />
                        <Text style={{ fontSize: 14, color: Colors.textSecondary, marginLeft: 8, flex: 1 }}>
                            {vehicle?.vehicle_type || 'Vehicle'}
                        </Text>
                        <View
                            style={{
                                backgroundColor: Colors.primaryLight,
                                borderRadius: 6,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                            }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.primary }}>
                                {route.distance_km} km · {Math.round(route.duration_min)} min
                            </Text>
                        </View>
                    </View>

                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginTop: 12,
                        }}
                    >
                        <Ionicons name="people-outline" size={20} color={Colors.textSecondary} />
                        <Text style={{ fontSize: 14, color: Colors.textSecondary, marginLeft: 8 }}>
                            Passengers
                        </Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text, marginLeft: 'auto' }}>
                            {route.employee_count} Total
                        </Text>
                    </View>
                </View>

                {/* Itinerary */}
                <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 16 }}>
                    Itinerary
                </Text>

                {(route.bus_stops || route.stops).map((stop, index) => {
                    const allStops = route.bus_stops || route.stops;
                    return (
                        <View key={index} style={{ flexDirection: 'row', marginBottom: 4 }}>
                            {/* Timeline */}
                            <View style={{ alignItems: 'center', width: 24, marginRight: 16 }}>
                                <View
                                    style={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: 6,
                                        backgroundColor: index === 0 ? Colors.primary : Colors.white,
                                        borderWidth: 2,
                                        borderColor: Colors.primary,
                                    }}
                                />
                                {index < allStops.length - 1 && (
                                    <View
                                        style={{
                                            width: 2,
                                            flex: 1,
                                            backgroundColor: Colors.primary,
                                            opacity: 0.3,
                                            minHeight: 50,
                                        }}
                                    />
                                )}
                            </View>

                            {/* Stop Content */}
                            <View
                                style={{
                                    flex: 1,
                                    backgroundColor: Colors.white,
                                    borderRadius: 12,
                                    padding: 16,
                                    marginBottom: 12,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.04,
                                    shadowRadius: 4,
                                    elevation: 1,
                                }}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text numberOfLines={1} style={{ flex: 1, marginRight: 8, fontSize: 15, fontWeight: '600', color: Colors.text }}>
                                        {getStopName(stop, index)}
                                    </Text>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.primary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                                        {formatTime(index, allStops.length)}
                                    </Text>
                                </View>
                                {index === allStops.length - 1 && (
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            marginTop: 8,
                                            backgroundColor: Colors.primaryLight,
                                            paddingHorizontal: 10,
                                            paddingVertical: 4,
                                            borderRadius: 6,
                                            alignSelf: 'flex-start',
                                        }}
                                    >
                                        <Ionicons name="flag" size={14} color={Colors.primary} />
                                        <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '600', marginLeft: 4 }}>
                                            Destination
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>



            {/* Side Menu */}
            <SideMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                userName={authUser?.name || 'Driver'}
                items={[
                    { icon: 'person-outline', label: 'My Profile', onPress: () => router.push('/(driver)/profile') },
                    { icon: 'time-outline', label: 'Route History', onPress: () => router.push('/(driver)/history'), dividerAfter: true },
                    { icon: 'settings-outline', label: 'Settings', onPress: () => { } },
                    { icon: 'log-out-outline', label: 'Logout', onPress: () => { AuthStore.clear(); LocationStore.clear(); router.replace('/'); } },
                ]}
            />
        </SafeAreaView>
    );
}
