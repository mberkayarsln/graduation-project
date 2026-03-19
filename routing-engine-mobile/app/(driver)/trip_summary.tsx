import React, { useEffect, useRef, useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import Button from '@/components/Button';
import { api } from '@/services/api';
import { SaveTripPayload } from '@/services/types';

export default function TripSummary() {
    const router = useRouter();
    const [saving, setSaving] = useState(true);
    const [saveError, setSaveError] = useState(false);
    const lastSavedTripKeyRef = useRef<string | null>(null);

    const params = useLocalSearchParams<{
        boarded: string;
        absentCount: string;
        totalPassengers: string;
        totalStops: string;
        distanceKm: string;
        durationMin: string;
        routeId: string;
        driverId: string;
        driverName: string;
        vehicleId: string;
        vehiclePlate: string;
        startedAt: string;
        status: string;
        passengersJson: string;
    }>();

    const boarded = parseInt(params.boarded || '0');
    const absentCount = parseInt(params.absentCount || '0');
    const totalPassengers = parseInt(params.totalPassengers || '0');
    const totalStops = parseInt(params.totalStops || '0');
    const distanceKm = parseFloat(params.distanceKm || '0');
    const durationMin = parseInt(params.durationMin || '0');
    const routeId = params.routeId || '?';
    const passengersJson = typeof params.passengersJson === 'string' ? params.passengersJson : '';
    const tripKey = [
        params.routeId || '0',
        params.startedAt || '',
        params.status || 'completed',
        params.driverId || '0',
    ].join('|');

    const boardingRate = totalPassengers > 0 ? Math.round((boarded / totalPassengers) * 100) : 0;

    // Persist trip to backend once per unique completed trip payload.
    useEffect(() => {
        if (!params.routeId) return;
        if (lastSavedTripKeyRef.current === tripKey) return;

        lastSavedTripKeyRef.current = tripKey;
        setSaving(true);
        setSaveError(false);

        const payload: SaveTripPayload = {
            routeId: parseInt(params.routeId || '0'),
            driverId: parseInt(params.driverId || '0') || undefined,
            driverName: params.driverName || undefined,
            vehicleId: parseInt(params.vehicleId || '0') || undefined,
            vehiclePlate: params.vehiclePlate || undefined,
            distanceKm,
            durationMin,
            totalStops,
            totalPassengers,
            boardedCount: boarded,
            absentCount,
            startedAt: params.startedAt || new Date().toISOString(),
            endedAt: new Date().toISOString(),
            status: (params.status as 'completed' | 'terminated') || 'completed',
            passengers: passengersJson ? JSON.parse(passengersJson) : [],
        };

        api.saveTrip(payload)
            .then(() => setSaving(false))
            .catch((err) => {
                console.error('Failed to save trip:', err);
                setSaveError(true);
                setSaving(false);
            });
    }, [
        tripKey,
        params.routeId,
        params.driverId,
        params.driverName,
        params.vehicleId,
        params.vehiclePlate,
        params.startedAt,
        params.status,
        passengersJson,
        distanceKm,
        durationMin,
        totalStops,
        totalPassengers,
        boarded,
        absentCount,
    ]);

    const stats = [
        { icon: 'people', label: 'Passengers Boarded', value: `${boarded} / ${totalPassengers}`, color: Colors.primary },
        { icon: 'flag', label: 'Stops Visited', value: String(totalStops), color: '#8B5CF6' },
        { icon: 'speedometer', label: 'Total Distance', value: `${distanceKm} km`, color: '#3B82F6' },
        { icon: 'time', label: 'Trip Duration', value: `${durationMin} min`, color: '#F59E0B' },
    ];

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
                {/* Success Icon */}
                <View
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: Colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                        marginTop: 20,
                        shadowColor: Colors.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 12,
                        elevation: 8,
                    }}
                >
                    <Ionicons name="checkmark" size={44} color="#fff" />
                </View>

                <Text style={{ fontSize: 26, fontWeight: '700', color: Colors.text, marginBottom: 4 }}>
                    Trip Complete!
                </Text>
                <Text style={{ fontSize: 15, color: Colors.textSecondary, marginBottom: 8 }}>
                    Route {routeId} · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                {saving && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                        <ActivityIndicator size="small" color={Colors.textSecondary} />
                        <Text style={{ marginLeft: 6, fontSize: 13, color: Colors.textSecondary }}>Saving trip...</Text>
                    </View>
                )}
                {saveError && (
                    <Text style={{ fontSize: 13, color: '#EF4444', marginBottom: 16 }}>Failed to save trip</Text>
                )}
                {!saving && !saveError && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                        <Ionicons name="cloud-done-outline" size={16} color={Colors.primary} />
                        <Text style={{ marginLeft: 4, fontSize: 13, color: Colors.primary }}>Trip saved</Text>
                    </View>
                )}

                {/* Boarding Rate Ring */}
                <View
                    style={{
                        backgroundColor: Colors.white,
                        borderRadius: 16,
                        padding: 24,
                        width: '100%',
                        alignItems: 'center',
                        marginBottom: 16,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 3,
                    }}
                >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Boarding Rate
                    </Text>
                    <Text style={{ fontSize: 48, fontWeight: '800', color: Colors.primary, marginTop: 4 }}>
                        {boardingRate}%
                    </Text>
                    <View
                        style={{
                            width: '100%',
                            height: 8,
                            backgroundColor: Colors.borderLight,
                            borderRadius: 4,
                            marginTop: 12,
                            overflow: 'hidden',
                        }}
                    >
                        <View
                            style={{
                                height: 8,
                                width: `${boardingRate}%`,
                                backgroundColor: Colors.primary,
                                borderRadius: 4,
                            }}
                        />
                    </View>
                </View>

                {/* Stats Grid */}
                <View
                    style={{
                        backgroundColor: Colors.white,
                        borderRadius: 16,
                        padding: 20,
                        width: '100%',
                        marginBottom: 24,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 3,
                    }}
                >
                    {stats.map((stat, i) => (
                        <View
                            key={i}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 14,
                                borderBottomWidth: i < stats.length - 1 ? 1 : 0,
                                borderBottomColor: Colors.borderLight,
                            }}
                        >
                            <View
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 12,
                                    backgroundColor: stat.color + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 14,
                                }}
                            >
                                <Ionicons name={stat.icon as any} size={20} color={stat.color} />
                            </View>
                            <Text style={{ flex: 1, fontSize: 15, color: Colors.textSecondary, fontWeight: '500' }}>
                                {stat.label}
                            </Text>
                            <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.text }}>
                                {stat.value}
                            </Text>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={{ padding: 20, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.borderLight, gap: 10 }}>
                <Button
                    title="Back to Route"
                    onPress={() => router.replace('/(driver)/route')}
                    icon="arrow-back-outline"
                    variant="outline"
                />
            </View>
        </SafeAreaView>
    );
}
