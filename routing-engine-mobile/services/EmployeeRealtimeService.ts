import { AuthStore } from './AuthStore';
import { NotificationService } from './NotificationService';
import { SocketService } from './SocketService';

class _EmployeeRealtimeService {
    private started = false;
    private joinedClusterId: number | null = null;
    private unsubscribers: (() => void)[] = [];
    private approachingNotified = false;

    private isEmployeeSession(): boolean {
        const user = AuthStore.get();
        return !!user && user.role === 'employee';
    }

    private getPickupPoint(): { lat: number; lon: number } | null {
        const user = AuthStore.get();
        if (!user || user.role !== 'employee' || !user.pickupPoint) return null;
        return { lat: user.pickupPoint[0], lon: user.pickupPoint[1] };
    }

    private distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
        const R = 6371000;
        const dLat = ((bLat - aLat) * Math.PI) / 180;
        const dLon = ((bLon - aLon) * Math.PI) / 180;
        const x =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((aLat * Math.PI) / 180) *
                Math.cos((bLat * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    }

    async start(): Promise<void> {
        if (this.started) return;
        if (!this.isEmployeeSession()) return;

        const user = AuthStore.get();
        if (!user || user.role !== 'employee' || user.clusterId == null) return;

        await NotificationService.init();

        SocketService.connect();
        SocketService.joinRoute(user.clusterId, 'employee');
        this.joinedClusterId = user.clusterId;

        this.unsubscribers.push(
            SocketService.onTripStarted((data) => {
                if (data.routeId !== this.joinedClusterId) return;
                this.approachingNotified = false;
                NotificationService.tripStarted(data.driverName);
            })
        );

        this.unsubscribers.push(
            SocketService.onTripUpdate((data) => {
                if (data.routeId !== this.joinedClusterId || !data.tripActive) return;

                const pickup = this.getPickupPoint();
                if (!pickup) return;

                const dist = this.distanceMeters(
                    data.latitude,
                    data.longitude,
                    pickup.lat,
                    pickup.lon
                );

                if (dist <= 300 && !this.approachingNotified) {
                    this.approachingNotified = true;
                    NotificationService.driverApproaching();
                }
            })
        );

        this.unsubscribers.push(
            SocketService.onTripEnded((data) => {
                if (data.routeId !== this.joinedClusterId) return;
                this.approachingNotified = false;
                NotificationService.tripCompleted();
            })
        );

        this.started = true;
    }

    stop(): void {
        if (this.joinedClusterId != null) {
            SocketService.leaveRoute(this.joinedClusterId);
        }

        this.unsubscribers.forEach((unsub) => unsub());
        this.unsubscribers = [];
        this.started = false;
        this.joinedClusterId = null;
        this.approachingNotified = false;
    }
}

export const EmployeeRealtimeService = new _EmployeeRealtimeService();
