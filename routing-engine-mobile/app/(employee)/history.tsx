import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, SafeAreaView, FlatList, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';
import { AuthStore } from '@/services/AuthStore';
import { api } from '@/services/api';
import { TripHistory } from '@/services/types';

function normalizeBoardingStatus(status?: string): 'confirmed' | 'declined' | 'waiting' {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'confirmed' || normalized === 'boarded') return 'confirmed';
    if (normalized === 'declined' || normalized === 'absent') return 'declined';
    return 'waiting';
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getBoardingColor(status?: string): string {
    switch (status) {
        case 'confirmed': return Colors.primary;
        case 'declined': return Colors.error;
        default: return Colors.warning;
    }
}

function getBoardingLabel(status?: string): string {
    switch (status) {
        case 'confirmed': return 'Boarded';
        case 'declined': return 'Absent';
        default: return 'Waiting';
    }
}

function getBoardingIcon(status?: string): string {
    switch (status) {
        case 'confirmed': return 'checkmark-circle';
        case 'declined': return 'close-circle';
        default: return 'time';
    }
}

function RideCard({ trip }: { trip: TripHistory }) {
    const boardingStatus = normalizeBoardingStatus(trip.boarding_status);
    const color = getBoardingColor(boardingStatus);
    const label = getBoardingLabel(boardingStatus);
    const icon = getBoardingIcon(boardingStatus);

    return (
        <View
            style={{
                backgroundColor: Colors.white,
                borderRadius: 14,
                marginHorizontal: 16,
                marginBottom: 12,
                padding: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2,
            }}
        >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: color + '15',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 10,
                        }}
                    >
                        <Ionicons name={icon as any} size={20} color={color} />
                    </View>
                    <View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text }}>
                            Route {trip.route_id}
                        </Text>
                        <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                            {trip.driver_name || 'Unknown Driver'}
                        </Text>
                    </View>
                </View>
                <View
                    style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                        backgroundColor: color + '15',
                    }}
                >
                    <Text style={{ fontSize: 11, fontWeight: '700', color, textTransform: 'uppercase' }}>
                        {label}
                    </Text>
                </View>
            </View>

            {/* Date / time + vehicle */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
                    <Text style={{ fontSize: 13, color: Colors.textSecondary, marginLeft: 6 }}>
                        {formatDate(trip.started_at)} · {formatTime(trip.started_at)}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="bus-outline" size={14} color={Colors.textSecondary} />
                    <Text style={{ fontSize: 13, color: Colors.textSecondary, marginLeft: 4 }}>
                        {trip.vehicle_plate || 'N/A'}
                    </Text>
                </View>
            </View>

            {/* Stats row */}
            <View
                style={{
                    flexDirection: 'row',
                    backgroundColor: Colors.background,
                    borderRadius: 10,
                    padding: 12,
                }}
            >
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.text }}>{trip.total_stops}</Text>
                    <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>Stops</Text>
                </View>
                <View style={{ width: 1, backgroundColor: Colors.border }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.text }}>{trip.distance_km} km</Text>
                    <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>Distance</Text>
                </View>
                <View style={{ width: 1, backgroundColor: Colors.border }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.text }}>{trip.duration_min}m</Text>
                    <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>Duration</Text>
                </View>
                <View style={{ width: 1, backgroundColor: Colors.border }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.text }}>{trip.boarded_count}/{trip.total_passengers}</Text>
                    <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>Boarded</Text>
                </View>
            </View>
        </View>
    );
}

export default function EmployeeHistory() {
    const [trips, setTrips] = useState<TripHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadTrips = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            const auth = AuthStore.get();
            const employeeId = auth?.role === 'employee' ? auth.id : null;
            if (employeeId == null) {
                setTrips([]);
                return;
            }

            const data = await api.getEmployeeTrips(employeeId);
            setTrips(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load employee trips:', err);
            Alert.alert('Connection Error', 'Could not load ride history. Please check your connection and try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadTrips();
    }, [loadTrips]);

    useFocusEffect(
        useCallback(() => {
            loadTrips();
        }, [loadTrips])
    );

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
            {/* Header */}
            <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: Colors.text }}>Ride History</Text>
                <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 4 }}>
                    {trips.length} ride{trips.length !== 1 ? 's' : ''} recorded
                </Text>
            </View>

            {trips.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                    <Ionicons name="time-outline" size={64} color={Colors.border} />
                    <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 16 }}>
                        No Rides Yet
                    </Text>
                    <Text style={{ fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
                        Your shuttle ride history will appear here after your first trip.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={trips}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => <RideCard trip={item} />}
                    contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => loadTrips(true)} tintColor={Colors.primary} />
                    }
                />
            )}
        </SafeAreaView>
    );
}
