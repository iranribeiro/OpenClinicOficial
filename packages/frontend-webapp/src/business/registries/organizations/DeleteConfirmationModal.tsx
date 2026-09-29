import React from 'react';
import { useI18n } from '../../../i18n/index.js';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  isBlocked?: boolean;
  blockedMessage?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  isBlocked = false,
  blockedMessage,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          maxWidth: 480,
          width: '100%',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ padding: '24px 24px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: isBlocked ? '#fef3c7' : '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                flexShrink: 0,
              }}
            >
              {isBlocked ? '⚠️' : '🗑️'}
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              {title}
            </h3>
          </div>

          <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
            {message}
          </p>

          {isBlocked && blockedMessage && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 8,
                padding: '12px 14px',
                color: '#b45309',
                fontSize: '0.82rem',
                lineHeight: 1.45,
                fontWeight: 500,
              }}
            >
              ⚠️ {blockedMessage}
            </div>
          )}
        </div>

        <div
          style={{
            background: '#f8fafc',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#475569',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
            }}
          >
            {t('GLOBAL_BTN_CANCEL')}
          </button>

          {!isBlocked && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#ffffff',
                background: '#dc2626',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              }}
            >
              {isLoading ? t('GLOBAL_LABEL_SAVING') : t('GLOBAL_BTN_CONFIRM')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
