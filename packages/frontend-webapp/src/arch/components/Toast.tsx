import React, { useEffect, useState, useRef, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

export interface ToastProps {
  toast: ToastItem;
  onClose: (id: string) => void;
}

const TYPE_CONFIG: Record<
  ToastType,
  {
    bg: string;
    border: string;
    text: string;
    titleColor: string;
    progressBarBg: string;
    icon: React.ReactNode;
    defaultTitle: string;
  }
> = {
  success: {
    bg: '#ffffff',
    border: '#86efac',
    text: '#15803d',
    titleColor: '#166534',
    progressBarBg: '#22c55e',
    defaultTitle: 'Success',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  error: {
    bg: '#ffffff',
    border: '#fca5a5',
    text: '#b91c1c',
    titleColor: '#991b1b',
    progressBarBg: '#ef4444',
    defaultTitle: 'Error',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  warning: {
    bg: '#ffffff',
    border: '#fde047',
    text: '#a16207',
    titleColor: '#854d0e',
    progressBarBg: '#eab308',
    defaultTitle: 'Warning',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  info: {
    bg: '#ffffff',
    border: '#7dd3fc',
    text: '#0369a1',
    titleColor: '#075985',
    progressBarBg: '#0284c7',
    defaultTitle: 'Information',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
};

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const duration = toast.duration ?? 4500;
  const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.info;
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 200);
  }, [onClose, toast.id]);

  useEffect(() => {
    if (duration <= 0) return;

    if (isPaused) {
      return;
    }

    const intervalTime = 25;
    const timer = setInterval(() => {
      remainingTimeRef.current -= intervalTime;
      const pct = Math.max(0, (remainingTimeRef.current / duration) * 100);
      setProgress(pct);

      if (remainingTimeRef.current <= 0) {
        clearInterval(timer);
        handleClose();
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [duration, isPaused, handleClose]);

  const handleMouseEnter = () => {
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    startTimeRef.current = Date.now();
    setIsPaused(false);
  };

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: 10,
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
        overflow: 'hidden',
        pointerEvents: 'auto',
        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
        transform: isExiting ? 'translateX(100%) scale(0.95)' : 'translateX(0) scale(1)',
        opacity: isExiting ? 0 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 14px', gap: 12 }}>
        <div style={{ flexShrink: 0, marginTop: 1 }}>{config.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {toast.title && (
            <div
              style={{
                fontSize: '0.86rem',
                fontWeight: 700,
                color: config.titleColor,
                marginBottom: 3,
                lineHeight: 1.25,
              }}
            >
              {toast.title}
            </div>
          )}
          <div
            style={{
              fontSize: '0.82rem',
              color: '#334155',
              fontWeight: 500,
              lineHeight: 1.4,
              wordBreak: 'break-word',
              whiteSpace: 'pre-line',
            }}
          >
            {toast.message}
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Dismiss notification"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: '1rem',
            lineHeight: 1,
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s ease, background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#0f172a';
            e.currentTarget.style.background = '#f1f5f9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          ✕
        </button>
      </div>

      {duration > 0 && (
        <div
          style={{
            height: 3,
            width: '100%',
            background: '#f1f5f9',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: config.progressBarBg,
              transition: isPaused ? 'none' : 'width 25ms linear',
            }}
          />
        </div>
      )}
    </div>
  );
};

export interface ToastContainerProps {
  toasts: ToastItem[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 24,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};
