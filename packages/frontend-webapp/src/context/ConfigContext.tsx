import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { getPublicConfig, applyDocumentBranding, type PublicConfig } from '../services/api.js';
import { LoginIdentifierType, DEFAULT_PLATFORM_MANIFEST } from '@openclinic/core/shared';

export interface ConfigContextValue {
  config: PublicConfig | null;
  isLoading: boolean;
  productName: string;
  appName: string;
  appSubtitle: string;
  appDescription: string;
  appVersion: string;
  appLogoUrl: string;
  appFaviconUrl: string;
  tenantName: string;
  defaultLocale: string;
  supportedLocales: string[];
  primaryLoginIdentifier: LoginIdentifierType;
  allowDirectUserCreation: boolean;
  refreshConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshConfig = useCallback(async () => {
    try {
      const data = await getPublicConfig();
      setConfig(data);
      const sub = data.appSubtitle;
      const effectiveTitle = data.appName && sub
        ? `${data.appName} - ${sub}`
        : (data.appName || DEFAULT_PLATFORM_MANIFEST.DEFAULT_APP_NAME);
      applyDocumentBranding(
        effectiveTitle,
        data.appFaviconUrl || DEFAULT_PLATFORM_MANIFEST.DEFAULT_APP_FAVICON_URL,
        data.defaultLocale || DEFAULT_PLATFORM_MANIFEST.DEFAULT_LOCALE
      );
    } catch (err) {
      console.warn('[ConfigProvider] Failed to load public config from backend, using safe fallbacks:', err);
      const fallbackTitle = `${DEFAULT_PLATFORM_MANIFEST.DEFAULT_APP_NAME} - ${DEFAULT_PLATFORM_MANIFEST.DEFAULT_APP_SUBTITLE}`;
      applyDocumentBranding(
        fallbackTitle,
        DEFAULT_PLATFORM_MANIFEST.DEFAULT_APP_FAVICON_URL,
        DEFAULT_PLATFORM_MANIFEST.DEFAULT_LOCALE
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  const value = useMemo<ConfigContextValue>(() => {
    const productName = config?.productName || DEFAULT_PLATFORM_MANIFEST.PRODUCT_NAME;
    const appName = config?.appName || DEFAULT_PLATFORM_MANIFEST.DEFAULT_APP_NAME;
    const appSubtitle = config?.appSubtitle || DEFAULT_PLATFORM_MANIFEST.DEFAULT_APP_SUBTITLE;
    const appDescription = config?.appDescription || DEFAULT_PLATFORM_MANIFEST.DEFAULT_APP_DESCRIPTION;
    const appVersion = config?.appVersion || DEFAULT_PLATFORM_MANIFEST.DEFAULT_APP_VERSION;
    const appLogoUrl = config?.appLogoUrl || DEFAULT_PLATFORM_MANIFEST.DEFAULT_APP_LOGO_URL;
    const appFaviconUrl = config?.appFaviconUrl || DEFAULT_PLATFORM_MANIFEST.DEFAULT_APP_FAVICON_URL;
    const tenantName = config?.tenantName || DEFAULT_PLATFORM_MANIFEST.DEFAULT_TENANT_NAME;
    const defaultLocale = config?.defaultLocale || DEFAULT_PLATFORM_MANIFEST.DEFAULT_LOCALE;
    const supportedLocales = config?.supportedLocales || (DEFAULT_PLATFORM_MANIFEST.SUPPORTED_LOCALES as unknown as string[]);
    const primaryLoginIdentifier = config?.primaryLoginIdentifier || LoginIdentifierType.CPF;
    const allowDirectUserCreation = config?.allowDirectUserCreation ?? DEFAULT_PLATFORM_MANIFEST.ALLOW_DIRECT_USER_CREATION;

    return {
      config,
      isLoading,
      productName,
      appName,
      appSubtitle,
      appDescription,
      appVersion,
      appLogoUrl,
      appFaviconUrl,
      tenantName,
      defaultLocale,
      supportedLocales,
      primaryLoginIdentifier,
      allowDirectUserCreation,
      refreshConfig,
    };
  }, [config, isLoading, refreshConfig]);

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return ctx;
}
