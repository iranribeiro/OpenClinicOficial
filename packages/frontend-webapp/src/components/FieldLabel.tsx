import React from 'react';
import { Tooltip } from '../arch/components/FormControls.js';

export interface FieldLabelProps {
  label: React.ReactNode;
  tooltip?: string;
  required?: boolean;
  htmlFor?: string;
  style?: React.CSSProperties;
}

export const FieldLabel: React.FC<FieldLabelProps> = ({
  label,
  tooltip,
  required,
  htmlFor,
  style,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
        ...style,
      }}
    >
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#334155',
          cursor: htmlFor ? 'pointer' : 'default',
        }}
      >
        {label}
        {required && (
          <span style={{ color: '#e11d48', marginLeft: 4, fontWeight: 700 }}>*</span>
        )}
      </label>

      {tooltip && (
        <Tooltip content={tooltip}>
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
              background: '#f1f5f9',
              color: '#64748b',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'help',
              border: '1px solid #cbd5e1',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            ⓘ
          </span>
        </Tooltip>
      )}
    </div>
  );
};
