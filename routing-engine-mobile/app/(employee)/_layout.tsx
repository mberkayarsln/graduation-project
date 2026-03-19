import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { EmployeeRealtimeService } from '@/services/EmployeeRealtimeService';

export default function EmployeeLayout() {
    useEffect(() => {
        EmployeeRealtimeService.start();
        return () => {
            EmployeeRealtimeService.stop();
        };
    }, []);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textMuted,
                tabBarStyle: {
                    backgroundColor: Colors.white,
                    borderTopColor: Colors.borderLight,
                    borderTopWidth: 1,
                    paddingTop: 8,
                    paddingBottom: 4,
                    height: 85,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    marginTop: 2,
                },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="home-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="tracking"
                options={{
                    title: 'Tracking',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="location-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="history"
                options={{
                    title: 'History',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="time-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="report"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}
