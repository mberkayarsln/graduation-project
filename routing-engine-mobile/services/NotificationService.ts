/**
 * NotificationService — Local push notifications via expo-notifications.
 *
 * Fires local notifications triggered by Socket.IO events:
 * - Trip started   → "Your shuttle has departed!"
 * - Driver nearby  → "Driver is approaching your stop"
 * - Trip ended     → "Trip completed"
 *
 * No server-side push infrastructure needed.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

class _NotificationService {
    private _initialized = false;

    /** Request permissions and set up Android notification channel. */
    async init(): Promise<boolean> {
        if (this._initialized) return true;

        // Android: create a notification channel
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('shuttle-updates', {
                name: 'Shuttle Updates',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#4CAF50',
                sound: 'default',
            });
        }

        // Request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        this._initialized = finalStatus === 'granted';
        if (!this._initialized) {
            console.warn('[Notifications] Permission not granted');
        }
        return this._initialized;
    }

    /** Send a local notification immediately. */
    async send(title: string, body: string, data?: Record<string, unknown>): Promise<void> {
        if (!this._initialized) {
            const ok = await this.init();
            if (!ok) return;
        }

        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: data || {},
                sound: 'default',
                ...(Platform.OS === 'android' ? { channelId: 'shuttle-updates' } : {}),
            },
            trigger: null, // Fire immediately
        });
    }

    /** Notify employee that the shuttle trip has started. */
    async tripStarted(driverName?: string): Promise<void> {
        await this.send(
            'Shuttle Departed!',
            driverName
                ? `${driverName} has started the trip. Track your shuttle in real-time.`
                : 'Your shuttle has departed! Track it in real-time.',
            { type: 'trip_started' },
        );
    }

    /** Notify employee that the driver is approaching their stop. */
    async driverApproaching(stopName?: string): Promise<void> {
        await this.send(
            'Driver Approaching!',
            stopName
                ? `Your shuttle is approaching ${stopName}. Get ready!`
                : 'Your shuttle is approaching your stop. Get ready!',
            { type: 'driver_approaching' },
        );
    }

    /** Notify employee that the shuttle has arrived at pickup point. */
    async driverArrived(stopName?: string): Promise<void> {
        await this.send(
            'Shuttle Arrived',
            stopName
                ? `Your shuttle has arrived at ${stopName}. Please board now.`
                : 'Your shuttle has arrived at your pickup point. Please board now.',
            { type: 'driver_arrived' },
        );
    }

    /** Notify employee that shuttle reached the final stop. */
    async destinationArrived(): Promise<void> {
        await this.send(
            'Destination Reached',
            'Your shuttle has reached the final stop.',
            { type: 'destination_arrived' },
        );
    }

    /** Notify employee that the trip has been completed. */
    async tripCompleted(): Promise<void> {
        await this.send(
            'Trip Completed',
            'Your shuttle trip has ended. Have a great day!',
            { type: 'trip_completed' },
        );
    }
}

/** Singleton instance */
export const NotificationService = new _NotificationService();
