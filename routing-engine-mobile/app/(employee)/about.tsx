import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export default function AboutScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginLeft: 16 }}>About</Text>
            </View>

            <View style={{ flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 }}>
                {/* App Icon */}
                <View style={{
                    width: 80, height: 80, borderRadius: 20,
                    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20,
                    shadowColor: Colors.primary,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                }}>
                    <Ionicons name="bus" size={40} color={Colors.white} />
                </View>

                <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.text }}>Shuttle App</Text>
                <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 4 }}>Version 1.0.0</Text>

                <Text style={{ fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 24, lineHeight: 22 }}>
                    Employee shuttle tracking and management application. Built as part of a graduation project for service route optimization.
                </Text>

                {/* Info Cards */}
                <View style={{ backgroundColor: Colors.white, borderRadius: 14, width: '100%', marginTop: 32 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                        <Ionicons name="code-slash-outline" size={20} color={Colors.textSecondary} />
                        <Text style={{ fontSize: 15, color: Colors.text, marginLeft: 12, flex: 1 }}>Built with</Text>
                        <Text style={{ fontSize: 14, color: Colors.textSecondary }}>React Native + Expo</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                        <Ionicons name="server-outline" size={20} color={Colors.textSecondary} />
                        <Text style={{ fontSize: 15, color: Colors.text, marginLeft: 12, flex: 1 }}>Backend</Text>
                        <Text style={{ fontSize: 14, color: Colors.textSecondary }}>Flask + OSRM</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
                        <Ionicons name="map-outline" size={20} color={Colors.textSecondary} />
                        <Text style={{ fontSize: 15, color: Colors.text, marginLeft: 12, flex: 1 }}>Maps</Text>
                        <Text style={{ fontSize: 14, color: Colors.textSecondary }}>React Native Maps</Text>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
