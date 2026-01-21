import { makeAutoObservable } from 'mobx';

type ToastType = 'error' | 'info' | 'success';

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
  state: 'enter' | 'leave';
};

class ToastStore {
  toasts: ToastItem[] = [];
  private nextId = 1;
  private timers = new Map<number, number>();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  show(message: string, type: ToastType = 'info') {
    const id = this.nextId++;
    this.toasts = [...this.toasts, { id, message, type, state: 'enter' }];
    const timer = window.setTimeout(() => this.markLeaving(id), 3200);
    this.timers.set(id, timer);
  }

  markLeaving(id: number) {
    this.toasts = this.toasts.map((toast) =>
      toast.id === id ? { ...toast, state: 'leave' } : toast
    );
    const timer = window.setTimeout(() => this.remove(id), 400);
    this.timers.set(id, timer);
  }

  remove(id: number) {
    const timer = this.timers.get(id);
    if (timer) {
      window.clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
  }
}

export const toastStore = new ToastStore();
