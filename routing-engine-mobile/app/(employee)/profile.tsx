import React from 'react';
import { View, Text, SafeAreaView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { AuthStore } from '@/services/AuthStore';

export default function EmployeeProfile() {
    const user = AuthStore.get();
    const name = user?.name || 'Employee';
    const email = user?.email || 'employee@company.com';
    const empId = user?.id;
    const clusterId = user?.clusterId;
    const zoneId = user?.zoneId;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
            <View style={{ flex: 1, alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 }}>
                <Image
                    source={{ uri: `https://i.pravatar.cc/100?u=emp-${empId ?? 0}` }}
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        marginBottom: 16,
                        backgroundColor: Colors.borderLight,
                    }}
                />
                <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.text }}>
                    {name}
                </Text>
                <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 4 }}>
                    Employee{empId != null ? ` #${empId}` : ''}
                </Text>

                <View
                    style={{
                        backgroundColor: Colors.white,
                        borderRadius: 16,
                        padding: 20,
                        width: '100%',
                        marginTop: 24,
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                        <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
                        <Text style={{ marginLeft: 12, fontSize: 15, color: Colors.text }}>{email}</Text>
                    </View>
                    {clusterId != null && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                            <Ionicons name="git-merge-outline" size={20} color={Colors.textSecondary} />
                            <Text style={{ marginLeft: 12, fontSize: 15, color: Colors.text }}>Cluster #{clusterId}</Text>
                        </View>
                    )}
                    {zoneId != null && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                            <Ionicons name="map-outline" size={20} color={Colors.textSecondary} />
                            <Text style={{ marginLeft: 12, fontSize: 15, color: Colors.text }}>Zone #{zoneId}</Text>
                        </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="business-outline" size={20} color={Colors.textSecondary} />
                        <Text style={{ marginLeft: 12, fontSize: 15, color: Colors.text }}>Employee Office</Text>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
