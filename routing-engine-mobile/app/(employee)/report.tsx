import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const ISSUE_TYPES = [
    { id: 'late', icon: 'time-outline', label: 'Shuttle was late' },
    { id: 'missed', icon: 'close-circle-outline', label: 'Missed my stop' },
    { id: 'driver', icon: 'person-outline', label: 'Driver behavior' },
    { id: 'condition', icon: 'car-outline', label: 'Vehicle condition' },
    { id: 'route', icon: 'map-outline', label: 'Route issue' },
    { id: 'other', icon: 'chatbox-outline', label: 'Other' },
];

export default function ReportScreen() {
    const router = useRouter();
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [description, setDescription] = useState('');

    function handleSubmit() {
        if (!selectedType) {
            Alert.alert('Select Issue Type', 'Please select an issue type before submitting.');
            return;
        }
        Alert.alert('Report Submitted', 'Thank you! Your report has been sent to the operations team.', [
            { text: 'OK', onPress: () => router.back() },
        ]);
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginLeft: 16 }}>Report an Issue</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                    What happened?
                </Text>

                {/* Issue Type Grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                    {ISSUE_TYPES.map(type => (
                        <TouchableOpacity
                            key={type.id}
                            onPress={() => setSelectedType(type.id)}
                            style={{
                                width: '48%',
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: selectedType === type.id ? Colors.primaryLight : Colors.white,
                                borderRadius: 12,
                                padding: 14,
                                borderWidth: 1.5,
                                borderColor: selectedType === type.id ? Colors.primary : Colors.borderLight,
                            }}
                        >
                            <Ionicons
                                name={type.icon as any}
                                size={20}
                                color={selectedType === type.id ? Colors.primary : Colors.textSecondary}
                            />
                            <Text style={{
                                fontSize: 13,
                                color: selectedType === type.id ? Colors.primary : Colors.text,
                                fontWeight: selectedType === type.id ? '600' : '400',
                                marginLeft: 8,
                                flex: 1,
                            }}>
                                {type.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Description */}
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                    Details (optional)
                </Text>
                <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Describe the issue..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    numberOfLines={4}
                    style={{
                        backgroundColor: Colors.white,
                        borderRadius: 12,
                        padding: 16,
                        fontSize: 15,
                        color: Colors.text,
                        height: 120,
                        textAlignVertical: 'top',
                        borderWidth: 1,
                        borderColor: Colors.borderLight,
                        marginBottom: 24,
                    }}
                />

                {/* Submit Button */}
                <TouchableOpacity
                    onPress={handleSubmit}
                    style={{
                        backgroundColor: Colors.primary,
                        borderRadius: 12,
                        paddingVertical: 16,
                        alignItems: 'center',
                    }}
                >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.white }}>Submit Report</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}
