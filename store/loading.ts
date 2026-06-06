// store/loading.ts
'use client';
import { create } from 'zustand';

type LoadingState = {
  busy: boolean;
  message: string;
  start: (message?: string) => void;
  stop: () => void;
};

export const useLoading = create<LoadingState>((set) => ({
  busy: false,
  message: '',
  start: (message = 'Aguarde...') => set({ busy: true, message }),
  stop: () => set({ busy: false, message: '' })
}));

export async function withLoading<T>(message: string, fn: () => Promise<T>): Promise<T> {
  const { start, stop } = useLoading.getState();
  start(message);
  try {
    return await fn();
  } finally {
    stop();
  }
}
