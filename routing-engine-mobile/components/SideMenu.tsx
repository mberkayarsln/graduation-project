import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MENU_WIDTH = SCREEN_WIDTH * 0.68;

interface MenuItem {
    icon: string;
    label: string;
    onPress: () => void;
    dividerAfter?: boolean;
}

interface SideMenuProps {
    visible: boolean;
    onClose: () => void;
    items: MenuItem[];
    userName?: string;
    userEmail?: string;
}

export default function SideMenu({ visible, onClose, items, userName, userEmail }: SideMenuProps) {
    const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    bounciness: 2,
                    speed: 14,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else if (mounted) {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -MENU_WIDTH,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start(() => setMounted(false));
        }
    }, [visible]);

    if (!mounted) return null;

    return (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
            {/* Backdrop */}
            <Animated.View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: '#000',
                opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }),
            }}>
                <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={1}
                    onPress={onClose}
                />
            </Animated.View>

            {/* Menu Panel */}
            <Animated.View style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: MENU_WIDTH,
                backgroundColor: Colors.white,
                transform: [{ translateX: slideAnim }],
                shadowColor: '#000',
                shadowOffset: { width: 4, height: 0 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 20,
                paddingTop: Platform.OS === 'ios' ? 60 : 40,
            }}>
                {/* User Header */}
                <View style={{ paddingHorizontal: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                    <Image
                        source={{ uri: 'https://i.pravatar.cc/100?img=5' }}
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            marginBottom: 12,
                            backgroundColor: Colors.borderLight,
                        }}
                    />
                    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text }}>
                        {userName || 'Employee'}
                    </Text>
                    <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>
                        {userEmail || 'employee@company.com'}
                    </Text>
                </View>

                {/* Menu Items */}
                <View style={{ paddingTop: 8, flex: 1 }}>
                    {items.map((item, idx) => (
                        <View key={idx}>
                            <TouchableOpacity
                                onPress={() => {
                                    onClose();
                                    setTimeout(item.onPress, 300);
                                }}
                                activeOpacity={0.6}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 14,
                                    paddingHorizontal: 24,
                                }}
                            >
                                <Ionicons name={item.icon as any} size={22} color={Colors.textSecondary} />
                                <Text style={{ fontSize: 15, color: Colors.text, marginLeft: 16, fontWeight: '500' }}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                            {item.dividerAfter && (
                                <View style={{ height: 1, backgroundColor: Colors.borderLight, marginVertical: 4, marginHorizontal: 24 }} />
                            )}
                        </View>
                    ))}
                </View>

                {/* App Version */}
                <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                        Shuttle App v1.0.0
                    </Text>
                </View>
            </Animated.View>
        </View>
    );
}
