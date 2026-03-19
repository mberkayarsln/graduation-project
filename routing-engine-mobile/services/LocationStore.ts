/**
 * LocationStore — Shared in-memory singleton for simulating live driver location.
 *
 * In production this would be replaced with a real-time backend (WebSocket / Firebase).
 * For now, the driver `navigation.tsx` writes to it and employee `tracking.tsx` reads from it.
 */

export interface DriverLocation {
    latitude: number;
    longitude: number;
    currentStopIndex: number;
    totalStops: number;
    tripActive: boolean;
    routeId: number;
    updatedAt: number; // Date.now()
}

let _driverLocation: DriverLocation | null = null;

export const LocationStore = {
    /** Called by the driver screen to publish current position / stop */
    update(location: Omit<DriverLocation, 'updatedAt'>) {
        _driverLocation = {
            ...location,
            updatedAt: Date.now(),
        };
    },

    /** Called by the employee tracking screen to read driver position */
    get(): DriverLocation | null {
        return _driverLocation;
    },

    /** Check if a driver location exists and is recent (within 60s) */
    isActive(): boolean {
        if (!_driverLocation) return false;
        return _driverLocation.tripActive && (Date.now() - _driverLocation.updatedAt < 60000);
    },

    /** Clear on trip complete or logout */
    clear() {
        _driverLocation = null;
    },
};
