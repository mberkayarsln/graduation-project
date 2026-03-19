import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export type PassengerStatus = 'Waiting' | 'Boarded' | 'Absent';

type PassengerCardProps = {
    name: string;
    status: PassengerStatus;
    avatar: string;
    stopName?: string;
    /** Whether the status was set by the employee (self-check-in) vs driver */
    selfConfirmed?: boolean;
    onPress?: () => void;
};

export default function PassengerCard({ name, status, avatar, stopName, selfConfirmed, onPress }: PassengerCardProps) {
    const isBoarded = status === 'Boarded';
    const isAbsent = status === 'Absent';

    const statusColor = isBoarded ? Colors.primary : isAbsent ? '#EF4444' : Colors.textSecondary;
    const statusBg = isBoarded ? Colors.primaryLight : isAbsent ? '#FEE2E2' : 'transparent';

    const Wrapper = onPress ? TouchableOpacity : View;

    return (
        <Wrapper
            onPress={onPress}
            activeOpacity={0.6}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: Colors.borderLight,
                opacity: isAbsent ? 0.6 : 1,
            }}
        >
            <Image
                source={{ uri: avatar }}
                style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    marginRight: 12,
                    backgroundColor: Colors.borderLight,
                    opacity: isAbsent ? 0.5 : 1,
                }}
            />
            <View style={{ flex: 1 }}>
                <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: isAbsent ? Colors.textMuted : Colors.text,
                    textDecorationLine: isAbsent ? 'line-through' : 'none',
                }}>
                    {name}
                </Text>
                {/* Optional Stop Name Subtitle */}
                {stopName && (
                    <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>
                        📍 {stopName}
                    </Text>
                )}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 4,
                    backgroundColor: statusBg,
                    paddingHorizontal: status !== 'Waiting' ? 8 : 0,
                    paddingVertical: status !== 'Waiting' ? 2 : 0,
                    borderRadius: 4,
                    alignSelf: 'flex-start',
                    gap: 4,
                }}>
                    {isBoarded && <Ionicons name="checkmark-circle" size={14} color={statusColor} />}
                    {isAbsent && <Ionicons name="close-circle" size={14} color={statusColor} />}
                    <Text style={{ fontSize: 13, color: statusColor, fontWeight: '600' }}>
                        {status}
                    </Text>
                </View>
            </View>

        </Wrapper>
    );
}
