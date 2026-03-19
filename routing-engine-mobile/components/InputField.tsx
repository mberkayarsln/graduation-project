import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

type InputFieldProps = {
    placeholder: string;
    value: string;
    onChangeText: (text: string) => void;
    icon: keyof typeof Ionicons.glyphMap;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'email-address' | 'numeric';
};

export default function InputField({
    placeholder,
    value,
    onChangeText,
    icon,
    secureTextEntry = false,
    keyboardType = 'default',
}: InputFieldProps) {
    const [isSecure, setIsSecure] = useState(secureTextEntry);

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: Colors.white,
            }}
        >
            <Ionicons
                name={icon}
                size={20}
                color={Colors.textMuted}
                style={{ marginRight: 12 }}
            />
            <TextInput
                placeholder={placeholder}
                value={value}
                onChangeText={onChangeText}
                secureTextEntry={isSecure}
                keyboardType={keyboardType}
                placeholderTextColor={Colors.textMuted}
                style={{
                    flex: 1,
                    fontSize: 16,
                    color: Colors.text,
                }}
            />
            {secureTextEntry && (
                <TouchableOpacity onPress={() => setIsSecure(!isSecure)}>
                    <Ionicons
                        name={isSecure ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={Colors.textMuted}
                    />
                </TouchableOpacity>
            )}
        </View>
    );
}
