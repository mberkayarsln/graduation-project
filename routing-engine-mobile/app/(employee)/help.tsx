import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const FAQ_ITEMS = [
    {
        question: 'How do I change my pickup stop?',
        answer: 'Your pickup stop is automatically assigned based on your registered address. Contact the operations team if you need a different stop.',
    },
    {
        question: 'What if I miss my shuttle?',
        answer: 'If you miss the shuttle, please use the "Report an Issue" feature in the app. You can arrange alternative transportation through the operations team.',
    },
    {
        question: 'How early should I be at my stop?',
        answer: 'We recommend arriving at your pickup stop at least 5 minutes before the scheduled departure time.',
    },
    {
        question: 'Can I track the shuttle in real-time?',
        answer: 'Yes! Go to the Tracking tab to see your shuttle\'s live location, estimated arrival time, and route progress.',
    },
    {
        question: 'What if the shuttle is delayed?',
        answer: 'You\'ll receive a push notification if there\'s a significant delay. You can also check the real-time status in the Tracking tab.',
    },
    {
        question: 'How do I contact my driver?',
        answer: 'On the Tracking screen, tap the "Contact Driver" button to call or message your assigned driver.',
    },
];

export default function HelpScreen() {
    const router = useRouter();
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginLeft: 16 }}>Help & FAQ</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Support Card */}
                <View style={{ backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                        width: 44, height: 44, borderRadius: 22,
                        backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 14,
                    }}>
                        <Ionicons name="headset-outline" size={22} color={Colors.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}>Need help?</Text>
                        <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>support@shuttleapp.com</Text>
                    </View>
                </View>

                {/* FAQ */}
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                    Frequently Asked Questions
                </Text>
                <View style={{ backgroundColor: Colors.white, borderRadius: 14, overflow: 'hidden' }}>
                    {FAQ_ITEMS.map((item, i) => (
                        <TouchableOpacity
                            key={i}
                            onPress={() => setExpandedIdx(expandedIdx === i ? null : i)}
                            activeOpacity={0.7}
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 14,
                                borderBottomWidth: i < FAQ_ITEMS.length - 1 ? 1 : 0,
                                borderBottomColor: Colors.borderLight,
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 15, color: Colors.text, fontWeight: '600', flex: 1, marginRight: 12 }}>
                                    {item.question}
                                </Text>
                                <Ionicons
                                    name={expandedIdx === i ? 'chevron-up' : 'chevron-down'}
                                    size={18}
                                    color={Colors.textMuted}
                                />
                            </View>
                            {expandedIdx === i && (
                                <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 10, lineHeight: 20 }}>
                                    {item.answer}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
