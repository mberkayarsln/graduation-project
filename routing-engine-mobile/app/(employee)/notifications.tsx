import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { AppNotification, NotificationCenter } from '@/services/NotificationCenter';

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function EmployeeNotificationsScreen() {
    const router = useRouter();
    const [items, setItems] = useState<AppNotification[]>([]);

    useEffect(() => {
        const unsubscribe = NotificationCenter.subscribe('employee', setItems);
        return unsubscribe;
    }, []);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginLeft: 16 }}>Notifications</Text>
                </View>
                <TouchableOpacity onPress={() => NotificationCenter.clearForRole('employee')}>
                    <Text style={{ color: Colors.primary, fontWeight: '600' }}>Clear</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 120 }}>
                        <Ionicons name="notifications-off-outline" size={42} color={Colors.textMuted} />
                        <Text style={{ color: Colors.textSecondary, marginTop: 10 }}>No notifications yet.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={{ backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.borderLight }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 8 }}>{item.title}</Text>
                            <Text style={{ fontSize: 12, color: Colors.textMuted }}>{formatTime(item.createdAt)}</Text>
                        </View>
                        <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 6 }}>{item.message}</Text>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}
