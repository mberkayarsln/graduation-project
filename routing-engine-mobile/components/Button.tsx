import React from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

type ButtonProps = {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'outline';
    icon?: keyof typeof Ionicons.glyphMap;
    loading?: boolean;
    disabled?: boolean;
};

export default function Button({
    title,
    onPress,
    variant = 'primary',
    icon,
    loading = false,
    disabled = false,
}: ButtonProps) {
    const isPrimary = variant === 'primary';

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.8}
            style={{
                backgroundColor: isPrimary ? Colors.primary : 'transparent',
                borderRadius: 12,
                paddingVertical: 16,
                paddingHorizontal: 24,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: disabled ? 0.5 : 1,
                borderWidth: isPrimary ? 0 : 1.5,
                borderColor: isPrimary ? undefined : Colors.primary,
            }}
        >
            {loading ? (
                <ActivityIndicator color={isPrimary ? '#fff' : Colors.primary} />
            ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {icon && (
                        <Ionicons
                            name={icon}
                            size={20}
                            color={isPrimary ? '#fff' : Colors.primary}
                        />
                    )}
                    <Text
                        style={{
                            color: isPrimary ? '#fff' : Colors.primary,
                            fontSize: 16,
                            fontWeight: '600',
                        }}
                    >
                        {title}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}
