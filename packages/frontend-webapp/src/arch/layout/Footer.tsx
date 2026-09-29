import React from 'react';
import { useConfig } from '../../context/ConfigContext.js';
import { DEFAULT_PLATFORM_MANIFEST } from '@openclinic/core/shared';

export interface FooterProps {
  style?: React.CSSProperties;
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ style, className }) => {
  const { productName, appVersion } = useConfig();
  const effectiveProductName = productName || DEFAULT_PLATFORM_MANIFEST.PRODUCT_NAME;
  const effectiveVersion = appVersion || DEFAULT_PLATFORM_MANIFEST.DEFAULT_APP_VERSION;
  const prefix = DEFAULT_PLATFORM_MANIFEST.POWERED_BY_PREFIX;

  return (
    <footer
      className={className}
      style={{
        marginTop: 'auto',
        paddingTop: 16,
        paddingBottom: 16,
        textAlign: 'center',
        ...style,
      }}
    >
      <small style={{ color: '#94a3b8' }}>
        {prefix} <strong>{effectiveProductName}</strong> • v{effectiveVersion}
      </small>
    </footer>
  );
};
