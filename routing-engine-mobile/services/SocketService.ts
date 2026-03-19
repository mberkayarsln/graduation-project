/**
 * SocketService — Real-time Socket.IO client for driver/passenger tracking.
 *
 * Connects to the Flask-SocketIO backend and provides:
 * - Room-based routing (join/leave route rooms)
 * - Driver location broadcasting
 * - Trip lifecycle events (start/end)
 * - Passenger boarding confirmations
 *
 * Both driver and passenger screens import this singleton.
 */

import { io, Socket } from 'socket.io-client';
import { NotificationCenter } from './NotificationCenter';

const SOCKET_URL = 'http://localhost:5050';

// ---------------------------------------------------------------------------
// Event payload types
// ---------------------------------------------------------------------------

export interface TripUpdatePayload {
    routeId: number;
    tripActive: boolean;
    latitude: number;
    longitude: number;
    currentStopIndex: number;
    totalStops: number;
    driverName: string;
    vehiclePlate: string;
    boardingStatuses: Record<string, 'confirmed' | 'declined'>;
}

export interface BoardingChangedPayload {
    routeId: number;
    employeeId: number;
    status: 'confirmed' | 'declined';
}

export interface TripEndedPayload {
    routeId: number;
}

export interface BoardingCheckPayload {
    routeId: number;
    stopIndex: number;
    stopName: string;
}

// ---------------------------------------------------------------------------
// Event listener types
// ---------------------------------------------------------------------------

type TripStartedListener = (data: TripUpdatePayload) => void;
type TripUpdateListener = (data: TripUpdatePayload) => void;
type TripEndedListener = (data: TripEndedPayload) => void;
type BoardingChangedListener = (data: BoardingChangedPayload) => void;
type BoardingCheckListener = (data: BoardingCheckPayload) => void;
type ConnectionListener = (connected: boolean) => void;

// ---------------------------------------------------------------------------
// SocketService singleton
// ---------------------------------------------------------------------------

class _SocketService {
    private socket: Socket | null = null;
    private _connected = false;
    private _currentRoom: string | null = null;
    private _currentRole: 'driver' | 'employee' | null = null;

    // Listener registries
    private tripStartedListeners: TripStartedListener[] = [];
    private tripUpdateListeners: TripUpdateListener[] = [];
    private tripEndedListeners: TripEndedListener[] = [];
    private boardingChangedListeners: BoardingChangedListener[] = [];
    private boardingCheckListeners: BoardingCheckListener[] = [];
    private connectionListeners: ConnectionListener[] = [];

    private addNotificationForRole(
        role: 'employee' | 'driver',
        input: {
            type: 'trip_started' | 'trip_ended' | 'boarding_changed' | 'boarding_check' | 'system';
            title: string;
            message: string;
        }
    ): void {
        const sessionRole = NotificationCenter.inferRoleFromSession();
        if (sessionRole !== role) return;

        NotificationCenter.add({
            role,
            type: input.type,
            title: input.title,
            message: input.message,
        });
    }

    /** Connect to the Socket.IO server (idempotent). */
    connect(): void {
        // If a socket instance already exists, let Socket.IO manage reconnection.
        if (this.socket) return;

        this.socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
        });

        this.socket.on('connect', () => {
            console.log('[Socket] Connected:', this.socket?.id);
            this._connected = true;
            this.connectionListeners.forEach(fn => fn(true));

            const role = NotificationCenter.inferRoleFromSession();
            if (role) {
                NotificationCenter.add({
                    role,
                    type: 'system',
                    title: 'Connected',
                    message: 'Live updates are now active.',
                });
            }
        });

        this.socket.on('disconnect', () => {
            console.log('[Socket] Disconnected');
            this._connected = false;
            this.connectionListeners.forEach(fn => fn(false));

            const role = NotificationCenter.inferRoleFromSession();
            if (role) {
                NotificationCenter.add({
                    role,
                    type: 'system',
                    title: 'Disconnected',
                    message: 'Live updates paused. Reconnecting...',
                });
            }
        });

        this.socket.on('connect_error', (err) => {
            console.log('[Socket] Connection error:', err.message);
        });

        // Real-time events from server
        this.socket.on('trip_started', (data: TripUpdatePayload) => {
            console.log('[Socket] trip_started', data.routeId);
            // Employee-facing event: shuttle started.
            this.addNotificationForRole('employee', {
                type: 'trip_started',
                title: 'Trip Started',
                message: `Route ${data.routeId} has started${data.driverName ? ` by ${data.driverName}` : ''}.`,
            });
            this.tripStartedListeners.forEach(fn => fn(data));
        });

        this.socket.on('trip_update', (data: TripUpdatePayload) => {
            this.tripUpdateListeners.forEach(fn => fn(data));
        });

        this.socket.on('trip_ended', (data: TripEndedPayload) => {
            console.log('[Socket] trip_ended', data.routeId);
            // Employee-facing event: shuttle trip completed.
            this.addNotificationForRole('employee', {
                type: 'trip_ended',
                title: 'Trip Completed',
                message: `Route ${data.routeId} has ended.`,
            });
            this.tripEndedListeners.forEach(fn => fn(data));
        });

        this.socket.on('boarding_changed', (data: BoardingChangedPayload) => {
            console.log('[Socket] boarding_changed', data.employeeId, data.status);
            // Driver-facing event: passenger boarding status changed.
            this.addNotificationForRole('driver', {
                type: 'boarding_changed',
                title: 'Boarding Update',
                message: `Passenger #${data.employeeId} marked as ${data.status}.`,
            });
            this.boardingChangedListeners.forEach(fn => fn(data));
        });

        this.socket.on('boarding_check_started', (data: BoardingCheckPayload) => {
            console.log('[Socket] boarding_check_started at stop', data.stopIndex);
            // Employee-facing event: boarding check started at stop.
            this.addNotificationForRole('employee', {
                type: 'boarding_check',
                title: 'Boarding Check',
                message: `${data.stopName} stop check started.`,
            });
            this.boardingCheckListeners.forEach(fn => fn(data));
        });
    }

    /** Disconnect from the server. */
    disconnect(): void {
        if (this._currentRoom) {
            this.leaveRoute(parseInt(this._currentRoom.replace('route_', ''), 10));
        }
        this.socket?.disconnect();
        this.socket = null;
        this._connected = false;
    }

    /** Whether socket is currently connected. */
    get connected(): boolean {
        return this._connected;
    }

    // ------------------------------------------------------------------
    // Room management
    // ------------------------------------------------------------------

    /** Join a route room to send/receive events for that route. */
    joinRoute(routeId: number, role: 'driver' | 'employee'): void {
        const targetRoom = `route_${routeId}`;

        // Avoid duplicate join emits for the same route/role pair.
        if (this._currentRoom === targetRoom && this._currentRole === role) return;

        // If switching route/role, leave previous room first.
        if (this._currentRoom && this._currentRoom !== targetRoom) {
            const previousRouteId = parseInt(this._currentRoom.replace('route_', ''), 10);
            this.leaveRoute(previousRouteId);
        }

        this.socket?.emit('join_route', { routeId, role });
        this._currentRoom = targetRoom;
        this._currentRole = role;
    }

    /** Leave the route room. */
    leaveRoute(routeId: number): void {
        this.socket?.emit('leave_route', { routeId });
        this._currentRoom = null;
        this._currentRole = null;
    }

    // ------------------------------------------------------------------
    // Driver actions
    // ------------------------------------------------------------------

    /** Driver starts a trip — broadcasts to all passengers on the route. */
    startTrip(params: {
        routeId: number;
        latitude: number;
        longitude: number;
        totalStops: number;
        driverName: string;
        vehiclePlate: string;
    }): void {
        this.socket?.emit('trip_start', params);
    }

    /** Driver sends a location update. */
    sendLocationUpdate(params: {
        routeId: number;
        latitude: number;
        longitude: number;
        currentStopIndex: number;
    }): void {
        this.socket?.emit('location_update', params);
    }

    /** Driver ends the trip. */
    endTrip(routeId: number): void {
        this.socket?.emit('trip_end', { routeId });
    }

    /** Driver notifies passengers that boarding check has started at a stop. */
    startBoardingCheck(params: { routeId: number; stopIndex: number; stopName: string }): void {
        this.socket?.emit('boarding_check', params);
    }

    // ------------------------------------------------------------------
    // Passenger actions
    // ------------------------------------------------------------------

    /** Passenger confirms or declines boarding. */
    sendBoardingUpdate(routeId: number, employeeId: number, status: 'confirmed' | 'declined'): void {
        this.socket?.emit('boarding_update', { routeId, employeeId, status });
    }

    // ------------------------------------------------------------------
    // Event subscriptions
    // ------------------------------------------------------------------

    onTripStarted(listener: TripStartedListener): () => void {
        this.tripStartedListeners.push(listener);
        return () => {
            this.tripStartedListeners = this.tripStartedListeners.filter(fn => fn !== listener);
        };
    }

    onTripUpdate(listener: TripUpdateListener): () => void {
        this.tripUpdateListeners.push(listener);
        return () => {
            this.tripUpdateListeners = this.tripUpdateListeners.filter(fn => fn !== listener);
        };
    }

    onTripEnded(listener: TripEndedListener): () => void {
        this.tripEndedListeners.push(listener);
        return () => {
            this.tripEndedListeners = this.tripEndedListeners.filter(fn => fn !== listener);
        };
    }

    onBoardingChanged(listener: BoardingChangedListener): () => void {
        this.boardingChangedListeners.push(listener);
        return () => {
            this.boardingChangedListeners = this.boardingChangedListeners.filter(fn => fn !== listener);
        };
    }

    onBoardingCheckStarted(listener: BoardingCheckListener): () => void {
        this.boardingCheckListeners.push(listener);
        return () => {
            this.boardingCheckListeners = this.boardingCheckListeners.filter(fn => fn !== listener);
        };
    }

    onConnectionChange(listener: ConnectionListener): () => void {
        this.connectionListeners.push(listener);
        // Immediately notify with current state so UI doesn't stay stale
        listener(this._connected);
        return () => {
            this.connectionListeners = this.connectionListeners.filter(fn => fn !== listener);
        };
    }

    /** Remove all listeners (call on unmount). */
    removeAllListeners(): void {
        this.tripStartedListeners = [];
        this.tripUpdateListeners = [];
        this.tripEndedListeners = [];
        this.boardingChangedListeners = [];
        this.boardingCheckListeners = [];
        this.connectionListeners = [];
    }
}

/** Singleton instance */
export const SocketService = new _SocketService();
