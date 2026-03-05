import { createContext } from 'react'

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error';
  duration?: number;
}

export type ToastFn = (options: ToastOptions) => void;

export const ToastContext = createContext<ToastFn | null>(null)
