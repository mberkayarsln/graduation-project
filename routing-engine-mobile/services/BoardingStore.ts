/**
 * BoardingStore — Shared in-memory singleton for employee boarding confirmations.
 *
 * Employees write to this store when they confirm/decline boarding.
 * The driver navigation screen polls this store to auto-update passenger statuses.
 *
 * In production this would be backed by a real-time backend (WebSocket / Firebase).
 */

export type BoardingStatus = 'confirmed' | 'declined';

let _boardingMap: Record<number, BoardingStatus> = {};

export const BoardingStore = {
    /** Employee confirms they have boarded the shuttle. */
    confirm(employeeId: number) {
        _boardingMap[employeeId] = 'confirmed';
    },

    /** Employee declines — not riding today. */
    decline(employeeId: number) {
        _boardingMap[employeeId] = 'declined';
    },

    /** Get a single employee's boarding status. */
    getStatus(employeeId: number): BoardingStatus | null {
        return _boardingMap[employeeId] ?? null;
    },

    /** Get all boarding statuses (driver reads this). */
    getAll(): Record<number, BoardingStatus> {
        return { ..._boardingMap };
    },

    /** Clear all statuses on trip end or restart. */
    clear() {
        _boardingMap = {};
    },
};
