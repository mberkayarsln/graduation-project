/**
 * AuthStore — in-memory session singleton.
 *
 * Stores the currently logged-in user (employee or driver).
 * Mirrors the pattern of LocationStore: simple module-level state that
 * any screen can import and read synchronously.
 *
 * In production this should be backed by SecureStore / AsyncStorage and
 * a proper JWT, but for the graduation-project scope this is sufficient.
 */

export interface AuthUser {
    role: 'employee' | 'driver';

    /** Shared fields */
    id: number;
    name: string;
    email: string;

    /** Employee-only fields */
    lat?: number;
    lon?: number;
    clusterId?: number | null;
    pickupPoint?: [number, number] | null;
    zoneId?: number | null;
    excluded?: boolean;

    /** Driver-only fields */
    vehicleId?: number;
    vehicleType?: string;
    vehicleCapacity?: number;
    /** Cluster ID of the route this driver is assigned to (may be null). */
    routeClusterId?: number | null;
}

let _currentUser: AuthUser | null = null;

export const AuthStore = {
    /** Save logged-in user after successful login. */
    set(user: AuthUser): void {
        _currentUser = user;
    },

    /** Read the currently logged-in user, or null if not logged in. */
    get(): AuthUser | null {
        return _currentUser;
    },

    /** Returns true when a user session exists. */
    isLoggedIn(): boolean {
        return _currentUser !== null;
    },

    /** Clear session on logout. */
    clear(): void {
        _currentUser = null;
    },
};
