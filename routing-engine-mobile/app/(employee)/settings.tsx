import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export default function SettingsScreen() {
    const router = useRouter();
    const [notifications, setNotifications] = useState(true);
    const [shuttleAlerts, setShuttleAlerts] = useState(true);
    const [delayAlerts, setDelayAlerts] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [language, setLanguage] = useState<'en' | 'tr'>('en');

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginLeft: 16 }}>Settings</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Notifications Section */}
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                    Notifications
                </Text>
                <View style={{ backgroundColor: Colors.white, borderRadius: 14, marginBottom: 24 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Ionicons name="notifications-outline" size={20} color={Colors.textSecondary} />
                            <Text style={{ fontSize: 15, color: Colors.text, marginLeft: 12 }}>Push Notifications</Text>
                        </View>
                        <Switch value={notifications} onValueChange={setNotifications} trackColor={{ true: Colors.primary }} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Ionicons name="bus-outline" size={20} color={Colors.textSecondary} />
                            <Text style={{ fontSize: 15, color: Colors.text, marginLeft: 12 }}>Shuttle Arrival Alerts</Text>
                        </View>
                        <Switch value={shuttleAlerts} onValueChange={setShuttleAlerts} trackColor={{ true: Colors.primary }} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Ionicons name="alert-circle-outline" size={20} color={Colors.textSecondary} />
                            <Text style={{ fontSize: 15, color: Colors.text, marginLeft: 12 }}>Delay Notifications</Text>
                        </View>
                        <Switch value={delayAlerts} onValueChange={setDelayAlerts} trackColor={{ true: Colors.primary }} />
                    </View>
                </View>

                {/* Appearance Section */}
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                    Appearance
                </Text>
                <View style={{ backgroundColor: Colors.white, borderRadius: 14, marginBottom: 24 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Ionicons name="moon-outline" size={20} color={Colors.textSecondary} />
                            <Text style={{ fontSize: 15, color: Colors.text, marginLeft: 12 }}>Dark Mode</Text>
                        </View>
                        <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ true: Colors.primary }} />
                    </View>
                </View>

                {/* Language Section */}
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                    Language
                </Text>
                <View style={{ backgroundColor: Colors.white, borderRadius: 14, marginBottom: 24 }}>
                    <TouchableOpacity
                        onPress={() => setLanguage('en')}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}
                    >
                        <Text style={{ fontSize: 15, color: Colors.text }}>🇬🇧  English</Text>
                        {language === 'en' && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setLanguage('tr')}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}
                    >
                        <Text style={{ fontSize: 15, color: Colors.text }}>🇹🇷  Türkçe</Text>
                        {language === 'tr' && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
