import React from 'react';
import { t } from '../../i18n/index.js';

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
  align?: 'center' | 'left' | 'right';
  maxWidth?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  align = 'center',
  maxWidth = 320,
}) => {
  const [showTooltip, setShowTooltip] = React.useState(false);

  if (!content) return <>{children}</>;

  const horizontalPositionStyle: React.CSSProperties =
    align === 'right'
      ? { right: 0, left: 'auto', transform: 'none' }
      : align === 'left'
      ? { left: 0, right: 'auto', transform: 'none' }
      : { left: '50%', right: 'auto', transform: 'translateX(-50%)' };

  const arrowHorizontalStyle: React.CSSProperties =
    align === 'right'
      ? { right: 16, left: 'auto', transform: 'none' }
      : align === 'left'
      ? { left: 16, right: 'auto', transform: 'none' }
      : { left: '50%', right: 'auto', transform: 'translateX(-50%)' };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            ...(position === 'top'
              ? { bottom: 'calc(100% + 6px)', ...horizontalPositionStyle }
              : { top: 'calc(100% + 6px)', ...horizontalPositionStyle }),
            background: '#0f172a',
            color: '#f8fafc',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: '0.74rem',
            fontWeight: 400,
            lineHeight: 1.45,
            boxShadow: '0 4px 14px rgba(15, 23, 42, 0.3)',
            whiteSpace: 'pre-line',
            width: 'max-content',
            maxWidth,
            zIndex: 10000,
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          {content}
          {/* Tooltip Arrow */}
          <div
            style={{
              position: 'absolute',
              ...(position === 'top'
                ? {
                    top: '100%',
                    ...arrowHorizontalStyle,
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '5px solid #0f172a',
                  }
                : {
                    bottom: '100%',
                    ...arrowHorizontalStyle,
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderBottom: '5px solid #0f172a',
                  }),
              width: 0,
              height: 0,
            }}
          />
        </div>
      )}
    </div>
  );
};

export const FieldLabelWithTooltip: React.FC<{
  label: string;
  tooltip?: string;
  required?: boolean;
  tooltipPosition?: 'top' | 'bottom';
  tooltipAlign?: 'center' | 'left' | 'right';
  maxWidth?: number;
}> = ({ label, tooltip, required, tooltipPosition = 'top', tooltipAlign = 'center', maxWidth }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, position: 'relative' }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
        {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      {tooltip && (
        <Tooltip content={tooltip} position={tooltipPosition} align={tooltipAlign} maxWidth={maxWidth}>
          <span
            tabIndex={0}
            role="button"
            aria-label={tooltip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#e2e8f0',
              color: '#475569',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'help',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            ℹ️
          </span>
        </Tooltip>
      )}
    </div>
  );
};

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  activeText?: string;
  inactiveText?: string;
  title?: string;
  tooltip?: string;
  tooltipPosition?: 'top' | 'bottom';
  tooltipAlign?: 'center' | 'left' | 'right';
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  activeText = t('GLOBAL_STATUS_ACTIVE'),
  inactiveText = t('GLOBAL_STATUS_INACTIVE'),
  title,
  tooltip,
  tooltipPosition = 'top',
  tooltipAlign = 'center',
}) => {
  const currentStatus = checked ? activeText : inactiveText;
  const customTooltip = tooltip || title;

  const switchElement = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: checked ? '#f0fdf4' : '#fff7ed',
        border: checked ? '1px solid #bbf7d0' : '1px solid #fed7aa',
        padding: '3px 8px',
        borderRadius: 8,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        transition: 'all 0.2s ease',
      }}
      onClick={() => !disabled && onChange(!checked)}
    >
      <span
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: checked ? '#15803d' : '#ea580c',
        }}
      >
        {currentStatus}
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-label={customTooltip || currentStatus}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onChange(!checked);
        }}
        style={{
          position: 'relative',
          width: 36,
          height: 20,
          borderRadius: 20,
          background: checked ? '#16a34a' : '#cbd5e1',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 2,
          transition: 'background 0.2s ease',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transform: checked ? 'translateX(16px)' : 'translateX(0)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>
    </div>
  );

  if (customTooltip) {
    return (
      <Tooltip content={customTooltip} position={tooltipPosition} align={tooltipAlign}>
        {switchElement}
      </Tooltip>
    );
  }

  return switchElement;
};
