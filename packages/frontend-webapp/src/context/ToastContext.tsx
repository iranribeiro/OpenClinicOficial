import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { ToastContainer, type ToastItem, type ToastType } from '../arch/components/Toast.js';

export interface ShowToastOptions {
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ToastContextValue {
  showToast: (options: ShowToastOptions) => string;
  hideToast: (id: string) => void;
  toast: {
    success: (message: string, title?: string, duration?: number) => string;
    error: (message: string, title?: string, duration?: number) => string;
    warning: (message: string, title?: string, duration?: number) => string;
    info: (message: string, title?: string, duration?: number) => string;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE_TOASTS = 4;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = 'info', title, message, duration }: ShowToastOptions): string => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const newItem: ToastItem = {
        id,
        type,
        title,
        message,
        duration,
      };

      setToasts((prev) => {
        const updated = [newItem, ...prev];
        return updated.slice(0, MAX_VISIBLE_TOASTS);
      });

      return id;
    },
    [],
  );

  const toastHelpers = useMemo(
    () => ({
      success: (message: string, title?: string, duration?: number) =>
        showToast({ type: 'success', message, title, duration }),
      error: (message: string, title?: string, duration?: number) =>
        showToast({ type: 'error', message, title, duration: duration ?? 6000 }),
      warning: (message: string, title?: string, duration?: number) =>
        showToast({ type: 'warning', message, title, duration: duration ?? 5000 }),
      info: (message: string, title?: string, duration?: number) =>
        showToast({ type: 'info', message, title, duration }),
    }),
    [showToast],
  );

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      showToast,
      hideToast,
      toast: toastHelpers,
    }),
    [showToast, hideToast, toastHelpers],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onClose={hideToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
