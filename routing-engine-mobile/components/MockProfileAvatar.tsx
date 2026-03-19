import React from 'react';
import { View, ViewStyle } from 'react-native';

type MockProfileAvatarProps = {
    size?: number;
    style?: ViewStyle;
};

export default function MockProfileAvatar({ size = 56, style }: MockProfileAvatarProps) {
    const headSize = Math.round(size * 0.34);
    const shouldersWidth = Math.round(size * 0.9);
    const shouldersHeight = Math.round(size * 0.48);

    return (
        <View
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: '#E5E7EB',
                    overflow: 'hidden',
                    alignItems: 'center',
                },
                style,
            ]}
        >
            <View
                style={{
                    position: 'absolute',
                    top: Math.round(size * 0.24),
                    width: headSize,
                    height: headSize,
                    borderRadius: headSize / 2,
                    backgroundColor: '#B7BDC1',
                }}
            />
            <View
                style={{
                    position: 'absolute',
                    bottom: -Math.round(size * 0.12),
                    width: shouldersWidth,
                    height: shouldersHeight,
                    borderRadius: shouldersHeight,
                    backgroundColor: '#B7BDC1',
                }}
            />
        </View>
    );
}