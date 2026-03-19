import { AuthStore } from './AuthStore';

export type NotificationRole = 'employee' | 'driver';

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    createdAt: number;
    role: NotificationRole;
    type:
        | 'trip_started'
        | 'trip_update'
        | 'trip_ended'
        | 'destination_arrived'
        | 'boarding_changed'
        | 'boarding_check'
        | 'driver_approaching'
        | 'driver_arrived'
        | 'system';
}

type Listener = (items: AppNotification[]) => void;

class _NotificationCenter {
    private items: AppNotification[] = [];
    private listeners: Listener[] = [];
    private readonly maxItems = 150;
    private readonly duplicateWindowMs = 2500;

    add(input: Omit<AppNotification, 'id' | 'createdAt'>): void {
        const latestSame = this.items.find((item) =>
            item.role === input.role &&
            item.type === input.type &&
            item.title === input.title &&
            item.message === input.message,
        );

        if (latestSame && Date.now() - latestSame.createdAt < this.duplicateWindowMs) {
            return;
        }

        const next: AppNotification = {
            ...input,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            createdAt: Date.now(),
        };

        this.items = [next, ...this.items].slice(0, this.maxItems);
        this.emit();
    }

    getForRole(role: NotificationRole): AppNotification[] {
        return this.items.filter((item) => item.role === role);
    }

    clearForRole(role: NotificationRole): void {
        this.items = this.items.filter((item) => item.role !== role);
        this.emit();
    }

    subscribe(role: NotificationRole, listener: Listener): () => void {
        const wrapped: Listener = () => {
            listener(this.getForRole(role));
        };

        this.listeners.push(wrapped);
        wrapped(this.items);

        return () => {
            this.listeners = this.listeners.filter((fn) => fn !== wrapped);
        };
    }

    inferRoleFromSession(): NotificationRole | null {
        const user = AuthStore.get();
        if (!user) return null;
        return user.role;
    }

    private emit(): void {
        this.listeners.forEach((listener) => listener(this.items));
    }
}

export const NotificationCenter = new _NotificationCenter();
