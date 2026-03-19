import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/colors';
import Button from '@/components/Button';
import InputField from '@/components/InputField';
import { api } from '@/services/api';
import { AuthStore } from '@/services/AuthStore';
import { LocationStore } from '@/services/LocationStore';

export default function LoginScreen() {
  const router = useRouter();
  const [role, setRole] = useState<'employee' | 'driver'>('employee');
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      Alert.alert(
        'Missing Information',
        role === 'employee'
          ? 'Please enter your Employee Name or ID.'
          : 'Please enter your Driver Name or Vehicle ID.',
      );
      return;
    }

    try {
      setLoading(true);
      const res = await api.login({ role, identifier: trimmed });

      if (!res.success) {
        Alert.alert('Login Failed', res.error || 'Could not authenticate. Please try again.');
        return;
      }

      // Persist the session
      if (res.role === 'employee') {
        AuthStore.set({
          role: 'employee',
          id: res.id,
          name: res.name,
          email: res.email,
          lat: res.lat,
          lon: res.lon,
          clusterId: res.cluster_id ?? null,
          pickupPoint: res.pickup_point ?? null,
          zoneId: res.zone_id ?? null,
          excluded: res.excluded ?? false,
        });
        router.replace('/(employee)/home');
      } else {
        AuthStore.set({
          role: 'driver',
          id: res.id,
          name: res.name,
          email: res.email,
          vehicleId: res.vehicle_id,
          vehicleType: res.vehicle_type,
          vehicleCapacity: res.vehicle_capacity,
          routeClusterId: res.route_cluster_id ?? null,
        });
        // Clear any stale location data from a previous session
        LocationStore.clear();
        router.replace('/(driver)/route');
      }
    } catch (err: any) {
      Alert.alert('Connection Error', 'Could not reach the server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            justifyContent: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Text
            style={{
              fontSize: 32,
              fontWeight: '700',
              color: Colors.text,
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Welcome Back
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: Colors.textSecondary,
              textAlign: 'center',
              marginBottom: 32,
            }}
          >
            Enter your details to access the shuttle service
          </Text>

          {/* Role Toggle */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: Colors.borderLight,
              borderRadius: 12,
              padding: 4,
              marginBottom: 32,
            }}
          >
            <TouchableOpacity
              onPress={() => setRole('employee')}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: role === 'employee' ? Colors.white : 'transparent',
                alignItems: 'center',
                shadowColor: role === 'employee' ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: role === 'employee' ? 0.1 : 0,
                shadowRadius: 2,
                elevation: role === 'employee' ? 2 : 0,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: role === 'employee' ? '600' : '400',
                  color: role === 'employee' ? Colors.text : Colors.textMuted,
                }}
              >
                Employee
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setRole('driver')}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: role === 'driver' ? Colors.white : 'transparent',
                alignItems: 'center',
                shadowColor: role === 'driver' ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: role === 'driver' ? 0.1 : 0,
                shadowRadius: 2,
                elevation: role === 'driver' ? 2 : 0,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: role === 'driver' ? '600' : '400',
                  color: role === 'driver' ? Colors.text : Colors.textMuted,
                }}
              >
                Driver
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email / Identifier Input */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: Colors.primary,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            {role === 'employee' ? 'Employee Name or ID' : 'Driver Name or Vehicle ID'}
          </Text>
          <InputField
            placeholder={
              role === 'employee' ? 'e.g. "Employee 42" or "42"' : 'e.g. "Ahmet Yılmaz" or "3"'
            }
            value={identifier}
            onChangeText={setIdentifier}
            icon={role === 'employee' ? 'person-outline' : 'bus-outline'}
            keyboardType="default"
          />

          <Text
            style={{
              fontSize: 11,
              color: Colors.textMuted,
              marginTop: 10,
              textAlign: 'center',
            }}
          >
            {role === 'employee'
              ? 'Enter your full name as registered, or your numeric employee ID.'
              : 'Enter your registered driver name or your vehicle ID number.'}
          </Text>

          {/* Sign In Button */}
          <View style={{ marginTop: 32 }}>
            {loading ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ marginTop: 8, color: Colors.textSecondary }}>Signing in…</Text>
              </View>
            ) : (
              <Button title="Sign In" onPress={handleSignIn} />
            )}
          </View>

          {/* Footer */}
          <TouchableOpacity style={{ marginTop: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: Colors.textSecondary }}>
              Need help?{' '}
              <Text style={{ color: Colors.primary, fontWeight: '600' }}>
                Contact Dispatch
              </Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
