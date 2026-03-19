export interface ToastData {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;
export const listeners: Set<(t: ToastData) => void> = new Set();

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const toast: ToastData = { id: ++toastId, message, type };
  listeners.forEach((fn) => fn(toast));
}
