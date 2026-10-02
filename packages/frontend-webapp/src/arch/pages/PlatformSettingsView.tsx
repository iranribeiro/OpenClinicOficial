import React, { useState, useEffect } from 'react';
import { SupportedLocales, getLocaleMetadata, LoginIdentifierType } from '@openclinic/core/shared';
import { useI18n, type TranslationKey } from '../../i18n/index.js';
import {
  getPlatformApplication,
  updatePlatformApplication,
  applyDocumentBranding,
  listTenants,
  type PlatformApplicationData,
  type TenantData,
} from '../../services/api.js';
import { FieldLabel } from '../../components/FieldLabel.js';
import { ToggleSwitch } from '../components/FormControls.js';
import { useConfig } from '../../context/ConfigContext.js';
import { useToast } from '../../context/ToastContext.js';
import { isValidCallingCode } from '../utils/phone.utils.js';

export const LOGO_ALLOWED_EXTENSIONS = ['png', 'svg', 'jpg', 'jpeg', 'webp', 'ico'];
export const FAVICON_ALLOWED_EXTENSIONS = ['ico', 'png', 'svg', 'webp'];

/**
 * Validates web asset URL or relative path for safety, structure, and supported image extensions.
 */
export function isValidAssetUrl(url: string, allowedExtensions: string[]): boolean {
  if (!url || !url.trim()) return true;
  const trimmed = url.trim();

  // Reject dangerous schemes
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return false;
  }

  let pathname = '';
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    pathname = trimmed.split('?')[0].split('#')[0];
  } else {
    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }
      pathname = parsed.pathname;
    } catch {
      return false;
    }
  }

  // Check supported file extension
  const extMatch = pathname.match(/\.([a-zA-Z0-9]+)$/);
  if (!extMatch) {
    return false;
  }
  return allowedExtensions.includes(extMatch[1].toLowerCase());
}

/**
 * Validates semantic version matching format up to 99.999.99999 according to SemVer best practices.
 * e.g. 1.0.0, 0.1.0, 10.20.300, 99.999.99999
 */
export function isValidAppVersion(version: string): boolean {
  if (!version || !version.trim()) return false;
  const semverRegex = /^(0|[1-9]\d{0,1})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,4})(-[0-9A-Za-z.-]+)?$/;
  return semverRegex.test(version.trim());
}

/**
 * Validates minimum password length (8 to 32 characters).
 */
export function isValidMinPasswordLength(length: number): boolean {
  return typeof length === 'number' && Number.isInteger(length) && length >= 8 && length <= 32;
}

/**
 * Generates a cryptographically strong password matching OWASP / NIST complexity requirements.
 */
export function generateCompliantPassword(
  length: number = 12,
  options: {
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
  } = {}
): string {
  const minLen = Math.max(8, length);
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const specials = '!@#$%^&*()-_=+[]{}|;:,.<>?';

  let pool = '';
  const requiredChars: string[] = [];

  if (options.requireUppercase ?? true) {
    pool += uppers;
    requiredChars.push(uppers[Math.floor(Math.random() * uppers.length)]);
  }
  if (options.requireLowercase ?? true) {
    pool += lowers;
    requiredChars.push(lowers[Math.floor(Math.random() * lowers.length)]);
  }
  if (options.requireNumbers ?? true) {
    pool += numbers;
    requiredChars.push(numbers[Math.floor(Math.random() * numbers.length)]);
  }
  if (options.requireSpecialChars ?? true) {
    pool += specials;
    requiredChars.push(specials[Math.floor(Math.random() * specials.length)]);
  }

  if (!pool) pool = lowers + numbers;

  const resultChars = [...requiredChars];
  const remainingCount = minLen - requiredChars.length;
  if (remainingCount > 0 && typeof window !== 'undefined' && window.crypto) {
    const array = new Uint32Array(remainingCount);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < array.length; i++) {
      resultChars.push(pool[array[i] % pool.length]);
    }
  } else {
    for (let i = 0; i < remainingCount; i++) {
      resultChars.push(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  // Shuffle using Fisher-Yates
  for (let i = resultChars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [resultChars[i], resultChars[j]] = [resultChars[j], resultChars[i]];
  }

  return resultChars.join('');
}

export const PlatformSettingsView: React.FC = () => {
  const { t, setSupportedLocales } = useI18n();
  const { refreshConfig } = useConfig();

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'branding' | 'security' | 'governance'>('branding');
  const { toast } = useToast();

  // Form Fields mapped directly to sys_applications
  const [defaultTenant, setDefaultTenant] = useState<TenantData | null>(null);
  const [appId, setAppId] = useState<string>('');
  const [appCode, setAppCode] = useState<string>('');
  const [appName, setAppName] = useState<string>('');
  const [appSubtitle, setAppSubtitle] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('');
  const [appDescription, setAppDescription] = useState<string>('');
  const [appLogoUrl, setAppLogoUrl] = useState<string>('');
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoLoadFailed, setLogoLoadFailed] = useState<boolean>(false);
  const [appFaviconUrl, setAppFaviconUrl] = useState<string>('');
  const [faviconError, setFaviconError] = useState<string | null>(null);
  const [faviconLoadFailed, setFaviconLoadFailed] = useState<boolean>(false);

  // Security Invariants & Password Requirements (OWASP / NIST)
  const [primaryLoginIdentifier, setPrimaryLoginIdentifier] = useState<LoginIdentifierType>(LoginIdentifierType.CPF);
  const [maxLoginAttempts, setMaxLoginAttempts] = useState<number>(5);
  const [lockoutDuration, setLockoutDuration] = useState<number>(15);
  const [sessionTimeout, setSessionTimeout] = useState<number>(30);
  const [minPasswordLength, setMinPasswordLength] = useState<number>(8);
  const [requireUppercase, setRequireUppercase] = useState<boolean>(true);
  const [requireLowercase, setRequireLowercase] = useState<boolean>(true);
  const [requireNumbers, setRequireNumbers] = useState<boolean>(true);
  const [requireSpecialChars, setRequireSpecialChars] = useState<boolean>(true);
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(false);
  const [resetTokenTtl, setResetTokenTtl] = useState<number>(24);
  const [allowDirectUserCreation, setAllowDirectUserCreation] = useState<boolean>(true);

  // Governance & Platform defaults
  const [auditRetentionDays, setAuditRetentionDays] = useState<number>(365);
  const [isMultiTenant, setIsMultiTenant] = useState<boolean>(false);
  const [defaultLocale, setDefaultLocale] = useState<string>(SupportedLocales.PT_BR);
  const [supportedLocales, setLocalSupportedLocales] = useState<string[]>([
    SupportedLocales.PT_BR,
    SupportedLocales.EN_US,
  ]);
  const [defaultTimezone, setDefaultTimezone] = useState<string>('');
  const [defaultDialingCode, setDefaultDialingCode] = useState<string>('');
  const [dialingCodeError, setDialingCodeError] = useState<string | null>(null);
  const [rawExtraSettings, setRawExtraSettings] = useState<Record<string, unknown>>({});

  const availableLocales = Object.values(SupportedLocales);

  const loadData = async () => {
    try {
      setLoading(true);
      const [app, tenantList] = await Promise.all([
        getPlatformApplication(),
        listTenants().catch(() => [] as TenantData[]),
      ]);

      const primary = tenantList.find((t) => t.isDefault) || tenantList[0] || null;
      setDefaultTenant(primary);

      setAppId(app.id);
      setAppCode(app.code);
      setAppName(app.appName ?? '');
      setAppSubtitle(app.appSubtitle ?? '');
      setAppVersion(app.appVersion ?? '');
      setAppDescription(app.appDescription ?? '');
      setAppLogoUrl(app.appLogoUrl ?? '');
      setLogoError(null);
      setLogoLoadFailed(false);
      setAppFaviconUrl(app.appFaviconUrl ?? '');
      setFaviconError(null);
      setFaviconLoadFailed(false);
      const docBrandingTitle = app.appName && app.appSubtitle ? `${app.appName} - ${app.appSubtitle}` : (app.appName || 'OpenClinic');
      applyDocumentBranding(docBrandingTitle, app.appFaviconUrl);

      const rawApp = app as PlatformApplicationData & { primary_login_identifier?: LoginIdentifierType };
      const loginId = app.primaryLoginIdentifier ?? rawApp.primary_login_identifier;
      if (loginId && Object.values(LoginIdentifierType).includes(loginId as LoginIdentifierType)) {
        setPrimaryLoginIdentifier(loginId as LoginIdentifierType);
      } else {
        setPrimaryLoginIdentifier(LoginIdentifierType.CPF);
      }

      setMaxLoginAttempts(app.defaultMaxLoginAttempts ?? 5);
      setLockoutDuration(app.defaultLockoutDurationMinutes ?? 15);
      setSessionTimeout(app.defaultSessionTimeoutMinutes ?? 30);
      setMinPasswordLength(Math.max(8, app.defaultMinPasswordLength ?? 8));
      setMfaEnabled(Boolean(app.defaultMfaEnabled));
      setResetTokenTtl(app.defaultPasswordResetTokenTtlHours ?? 24);
      setAllowDirectUserCreation(app.allowDirectUserCreation ?? true);

      // Load granular password complexity requirements
      const extra = (app.defaultExtraSettings as Record<string, any>) || {};
      setRawExtraSettings(extra);
      const policy = extra.passwordPolicy || {};
      setRequireUppercase(policy.requireUppercase ?? true);
      setRequireLowercase(policy.requireLowercase ?? true);
      setRequireNumbers(policy.requireNumbers ?? true);
      setRequireSpecialChars(policy.requireSpecialChars ?? true);

      setAuditRetentionDays(app.defaultAuditRetentionDays ?? 365);
      setIsMultiTenant(Boolean(app.isMultiTenant));
      setDefaultLocale(app.defaultLocale || SupportedLocales.PT_BR);

      if (Array.isArray(app.defaultSupportedLocales) && app.defaultSupportedLocales.length > 0) {
        setLocalSupportedLocales(app.defaultSupportedLocales);
        setSupportedLocales(app.defaultSupportedLocales);
      } else {
        const fallbackLocales = [SupportedLocales.PT_BR, SupportedLocales.EN_US];
        setLocalSupportedLocales(fallbackLocales);
        setSupportedLocales(fallbackLocales);
      }

      setDefaultTimezone(app.defaultTimezone ?? '');

      const ddi = app.defaultDialingCode ?? '';
      setDefaultDialingCode(ddi);
      if (ddi && !isValidCallingCode(ddi)) {
        setDialingCodeError(t('PLATFORM_SETTINGS_DIALING_CODE_INVALID'));
      } else {
        setDialingCodeError(null);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '';
      toast.error(t('PLATFORM_SETTINGS_LOAD_ERROR') + (errMsg ? ` (${errMsg})` : ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogoUrlChange = (val: string) => {
    setAppLogoUrl(val);
    setLogoLoadFailed(false);
    if (val.trim() && !isValidAssetUrl(val, LOGO_ALLOWED_EXTENSIONS)) {
      setLogoError(t('PLATFORM_SETTINGS_LOGO_URL_INVALID'));
    } else {
      setLogoError(null);
    }
  };

  const handleFaviconUrlChange = (val: string) => {
    setAppFaviconUrl(val);
    setFaviconLoadFailed(false);
    if (val.trim() && !isValidAssetUrl(val, FAVICON_ALLOWED_EXTENSIONS)) {
      setFaviconError(t('PLATFORM_SETTINGS_FAVICON_URL_INVALID'));
    } else {
      setFaviconError(null);
    }
  };

  const handleDialingCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.trim();
    if (raw && !raw.startsWith('+')) {
      raw = `+${raw.replace(/\D/g, '')}`;
    } else if (raw.startsWith('+')) {
      raw = `+${raw.slice(1).replace(/\D/g, '')}`;
    }
    const val = raw.slice(0, 5);
    setDefaultDialingCode(val);

    if (val && val !== '+') {
      if (!isValidCallingCode(val)) {
        setDialingCodeError(t('PLATFORM_SETTINGS_DIALING_CODE_INVALID'));
      } else {
        setDialingCodeError(null);
      }
    } else {
      setDialingCodeError(null);
    }
  };

  const handleToggleLocale = (loc: string) => {
    if (supportedLocales.includes(loc)) {
      if (supportedLocales.length <= 1) {
        toast.warning(t('PLATFORM_SETTINGS_AT_LEAST_ONE_LANG'));
        return;
      }
      const next = supportedLocales.filter((l) => l !== loc);
      setLocalSupportedLocales(next);
      if (defaultLocale === loc) {
        setDefaultLocale(next[0]);
      }
    } else {
      setLocalSupportedLocales([...supportedLocales, loc]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (appLogoUrl.trim() && !isValidAssetUrl(appLogoUrl, LOGO_ALLOWED_EXTENSIONS)) {
      toast.error(t('PLATFORM_SETTINGS_LOGO_URL_INVALID'));
      setActiveTab('branding');
      return;
    }

    if (appFaviconUrl.trim() && !isValidAssetUrl(appFaviconUrl, FAVICON_ALLOWED_EXTENSIONS)) {
      toast.error(t('PLATFORM_SETTINGS_FAVICON_URL_INVALID'));
      setActiveTab('branding');
      return;
    }

    if (defaultDialingCode && !isValidCallingCode(defaultDialingCode)) {
      toast.error(t('PLATFORM_SETTINGS_DIALING_CODE_INVALID'));
      setActiveTab('governance');
      return;
    }

    if (!isValidMinPasswordLength(Number(minPasswordLength))) {
      toast.error(t('PLATFORM_SETTINGS_MIN_PASS_LEN_INVALID'));
      setActiveTab('security');
      return;
    }

    try {
      setSaving(true);

      const payload: Partial<PlatformApplicationData> = {
        appName,
        appSubtitle,
        appDescription,
        appLogoUrl: appLogoUrl.trim() || null,
        appFaviconUrl: appFaviconUrl.trim() || null,
        primaryLoginIdentifier,
        defaultMaxLoginAttempts: Number(maxLoginAttempts),
        defaultLockoutDurationMinutes: Number(lockoutDuration),
        defaultSessionTimeoutMinutes: Number(sessionTimeout),
        defaultMinPasswordLength: Number(minPasswordLength),
        defaultMfaEnabled: mfaEnabled,
        defaultPasswordResetTokenTtlHours: Number(resetTokenTtl),
        defaultAuditRetentionDays: Number(auditRetentionDays),
        defaultExtraSettings: {
          ...rawExtraSettings,
          passwordPolicy: {
            requireUppercase,
            requireLowercase,
            requireNumbers,
            requireSpecialChars,
          },
        },
        allowDirectUserCreation,
        isMultiTenant,
        defaultLocale,
        defaultSupportedLocales: supportedLocales,
        defaultTimezone,
        defaultDialingCode,
      };

      await updatePlatformApplication(payload);
      await refreshConfig();
      setSupportedLocales(supportedLocales);
      toast.success(t('PLATFORM_SETTINGS_SAVED_SUCCESS'));
      await loadData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '';
      toast.error(t('PLATFORM_SETTINGS_SAVE_ERROR') + (errMsg ? ` (${errMsg})` : ''));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, color: '#64748b' }}>
        <p style={{ fontSize: '0.9rem' }}>{t('PLATFORM_SETTINGS_LOADING')}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Navigation Sub-Tabs & Context Meta Bar */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Navigation Sub-Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'branding' ? '1px solid #bae6fd' : '1px solid transparent',
              background: activeTab === 'branding' ? '#f0f9ff' : 'transparent',
              color: activeTab === 'branding' ? '#0284c7' : '#64748b',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>🎨</span>
            <span>{t('PLATFORM_SETTINGS_TAB_BRANDING')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'security' ? '1px solid #bae6fd' : '1px solid transparent',
              background: activeTab === 'security' ? '#f0f9ff' : 'transparent',
              color: activeTab === 'security' ? '#0284c7' : '#64748b',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>🔐</span>
            <span>{t('PLATFORM_SETTINGS_TAB_SECURITY')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('governance')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'governance' ? '1px solid #bae6fd' : '1px solid transparent',
              background: activeTab === 'governance' ? '#f0f9ff' : 'transparent',
              color: activeTab === 'governance' ? '#0284c7' : '#64748b',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>🏛️</span>
            <span>{t('PLATFORM_SETTINGS_TAB_GOVERNANCE')}</span>
          </button>
        </div>

        {/* Context Meta: Tenant & App Version */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          {defaultTenant && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#64748b' }}>
                {t('PLATFORM_SETTINGS_HEADER_TENANT')}:
              </span>
              <span style={{ fontSize: '0.80rem', fontWeight: 700, background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '3px 10px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span>🏢</span>
                <span>{defaultTenant.name}</span>
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#64748b' }}>
              {t('PLATFORM_SETTINGS_HEADER_APP')}:
            </span>
            <span style={{ fontSize: '0.80rem', fontWeight: 700, background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', padding: '3px 10px', borderRadius: 6 }}>
              {appName || 'OpenClinic'}
            </span>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, background: '#e0f2fe', color: '#0284c7', padding: '3px 8px', borderRadius: 6 }}>
              v{appVersion}
            </span>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Tab 1: Branding & Identity */}
        {activeTab === 'branding' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 18, alignItems: 'stretch' }}>
            {/* Group 1 (Left): Identidade */}
            <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🏷️</span>
                <span>{t('PLATFORM_SETTINGS_GROUP_IDENTITY')}</span>
              </h3>

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <FieldLabel
                    label={t('PLATFORM_SETTINGS_FIELD_APP_NAME')}
                    required
                  />
                  <input
                    type="text"
                    required
                    placeholder={t('PLATFORM_SETTINGS_APP_NAME_PLACEHOLDER')}
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ width: 140, flexShrink: 0 }}>
                  <FieldLabel
                    label={t('PLATFORM_SETTINGS_FIELD_APP_VERSION')}
                    tooltip={t('PLATFORM_SETTINGS_APP_VERSION_HINT')}
                  />
                  <div
                    title={t('PLATFORM_SETTINGS_APP_VERSION_HINT')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '9px 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#0369a1',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      cursor: 'default',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>🔒</span>
                    <span>{appVersion ? `v${appVersion.replace(/^v/, '')}` : '—'}</span>
                  </div>
                </div>
              </div>

              <div>
                <FieldLabel
                  label={t('PLATFORM_SETTINGS_FIELD_APP_SUBTITLE')}
                />
                <input
                  type="text"
                  placeholder={t('PLATFORM_SETTINGS_APP_SUBTITLE_PLACEHOLDER')}
                  value={appSubtitle}
                  onChange={(e) => setAppSubtitle(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <FieldLabel
                  label={t('PLATFORM_SETTINGS_FIELD_APP_DESC')}
                />
                <textarea
                  rows={4}
                  placeholder={t('PLATFORM_SETTINGS_APP_DESC_PLACEHOLDER')}
                  value={appDescription}
                  onChange={(e) => setAppDescription(e.target.value)}
                  style={{ width: '100%', flex: 1, minHeight: 90, padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Group 2 (Right): Branding */}
            <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🎨</span>
                <span>{t('PLATFORM_SETTINGS_GROUP_BRANDING')}</span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, justifyContent: 'space-between' }}>
                {/* Unified Logo Box */}
                <div style={{
                  border: logoError ? '1.5px solid #e11d48' : '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 14,
                  background: logoError ? '#fff1f2' : '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'all 0.15s ease',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <FieldLabel
                      label={t('PLATFORM_SETTINGS_FIELD_LOGO_URL')}
                      tooltip={t('PLATFORM_SETTINGS_LOGO_HINT')}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!appLogoUrl ? (
                        <button
                          type="button"
                          onClick={() => handleLogoUrlChange('/logo.png')}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                            padding: '2px 7px',
                            fontSize: '0.70rem',
                            color: '#0369a1',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          {t('PLATFORM_SETTINGS_USE_DEFAULT_LOGO')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleLogoUrlChange('')}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                            padding: '2px 7px',
                            fontSize: '0.70rem',
                            color: '#64748b',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          {t('PLATFORM_SETTINGS_CLEAR_FIELD')}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder={t('PLATFORM_SETTINGS_LOGO_PLACEHOLDER')}
                      value={appLogoUrl}
                      onChange={(e) => handleLogoUrlChange(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: 6,
                        border: logoError ? '1.5px solid #e11d48' : '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        background: '#ffffff',
                      }}
                    />
                    <div style={{
                      width: 100,
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#0f172a',
                      borderRadius: 6,
                      border: logoError || logoLoadFailed ? '1px solid #e11d48' : '1px solid #334155',
                      flexShrink: 0,
                      overflow: 'hidden',
                      padding: '2px 6px',
                    }}>
                      {appLogoUrl ? (
                        logoLoadFailed ? (
                          <span style={{ fontSize: '0.65rem', color: '#f87171', textAlign: 'center', lineHeight: 1.1 }}>
                            ⚠️ {t('PLATFORM_SETTINGS_IMAGE_LOAD_FAILED')}
                          </span>
                        ) : (
                          <img
                            src={appLogoUrl}
                            alt="Logo Preview"
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                            onLoad={() => setLogoLoadFailed(false)}
                            onError={() => setLogoLoadFailed(true)}
                          />
                        )
                      ) : (
                        <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          {t('PLATFORM_SETTINGS_NOT_CONFIGURED')}
                        </span>
                      )}
                    </div>
                  </div>
                  {logoError ? (
                    <div style={{ fontSize: '0.72rem', color: '#e11d48', marginTop: 2 }}>
                      ⚠️ {logoError}
                    </div>
                  ) : logoLoadFailed && appLogoUrl ? (
                    <div style={{ fontSize: '0.72rem', color: '#d97706', marginTop: 2 }}>
                      ⚠️ {t('PLATFORM_SETTINGS_IMAGE_LOAD_FAILED')}
                    </div>
                  ) : appLogoUrl ? (
                    <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: 2 }}>
                      ✓ {t('PLATFORM_SETTINGS_IMAGE_LOADED')}
                    </div>
                  ) : null}
                </div>

                {/* Unified Favicon Box */}
                <div style={{
                  border: faviconError ? '1.5px solid #e11d48' : '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 14,
                  background: faviconError ? '#fff1f2' : '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'all 0.15s ease',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <FieldLabel
                      label={t('PLATFORM_SETTINGS_FIELD_FAVICON_URL')}
                      tooltip={t('PLATFORM_SETTINGS_FAVICON_HINT')}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!appFaviconUrl ? (
                        <button
                          type="button"
                          onClick={() => handleFaviconUrlChange('/favicon.ico')}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                            padding: '2px 7px',
                            fontSize: '0.70rem',
                            color: '#0369a1',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          {t('PLATFORM_SETTINGS_USE_DEFAULT_FAVICON')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleFaviconUrlChange('')}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                            padding: '2px 7px',
                            fontSize: '0.70rem',
                            color: '#64748b',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          {t('PLATFORM_SETTINGS_CLEAR_FIELD')}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder={t('PLATFORM_SETTINGS_FAVICON_PLACEHOLDER')}
                      value={appFaviconUrl}
                      onChange={(e) => handleFaviconUrlChange(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: 6,
                        border: faviconError ? '1.5px solid #e11d48' : '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        background: '#ffffff',
                      }}
                    />
                    <div style={{
                      width: 40,
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#0f172a',
                      borderRadius: 6,
                      border: faviconError || faviconLoadFailed ? '1px solid #e11d48' : '1px solid #334155',
                      flexShrink: 0,
                      overflow: 'hidden',
                      padding: 2,
                    }}>
                      {appFaviconUrl ? (
                        faviconLoadFailed ? (
                          <span style={{ fontSize: '0.85rem' }}>⚠️</span>
                        ) : (
                          <img
                            src={appFaviconUrl}
                            alt="Favicon Preview"
                            style={{ width: 22, height: 22, objectFit: 'contain' }}
                            onLoad={() => setFaviconLoadFailed(false)}
                            onError={() => setFaviconLoadFailed(true)}
                          />
                        )
                      ) : (
                        <span style={{ fontSize: '0.75rem' }}>🌐</span>
                      )}
                    </div>
                  </div>
                  {faviconError ? (
                    <div style={{ fontSize: '0.72rem', color: '#e11d48', marginTop: 2 }}>
                      ⚠️ {faviconError}
                    </div>
                  ) : faviconLoadFailed && appFaviconUrl ? (
                    <div style={{ fontSize: '0.72rem', color: '#d97706', marginTop: 2 }}>
                      ⚠️ {t('PLATFORM_SETTINGS_IMAGE_LOAD_FAILED')}
                    </div>
                  ) : appFaviconUrl ? (
                    <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: 2 }}>
                      ✓ {t('PLATFORM_SETTINGS_IMAGE_LOADED')}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Security & Authentication */}
        {activeTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Top 2-Column Grid: Users & Auth (Left) & User Creation & MFA (Right Sibling) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 18, alignItems: 'stretch' }}>
              {/* Box 1 (Left): Usuários e Autenticação (Identificador Principal de Login) */}
              <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                  👥 {t('PLATFORM_SETTINGS_BOX_USERS_AUTH')}
                </h3>

                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                    {t('PLATFORM_SETTINGS_FIELD_PRIMARY_LOGIN_ID')}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                    {t('PLATFORM_SETTINGS_PRIMARY_LOGIN_ID_HINT')}
                  </div>
                </div>

                {/* Vertical stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, justifyContent: 'space-between' }}>
                  {/* Option 1: CPF (Default) */}
                  <div
                    onClick={() => setPrimaryLoginIdentifier(LoginIdentifierType.CPF)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      border: primaryLoginIdentifier === LoginIdentifierType.CPF ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                      background: primaryLoginIdentifier === LoginIdentifierType.CPF ? '#f0f9ff' : '#f8fafc',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.15rem' }}>🪪</span>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: primaryLoginIdentifier === LoginIdentifierType.CPF ? '#0369a1' : '#1e293b' }}>
                          {t('PLATFORM_SETTINGS_LOGIN_ID_CPF')}
                        </div>
                        <div style={{ fontSize: '0.70rem', color: '#64748b' }}>
                          {t('PLATFORM_SETTINGS_LOGIN_ID_CPF_DESC')}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      background: primaryLoginIdentifier === LoginIdentifierType.CPF ? '#0284c7' : '#ffffff',
                      color: '#ffffff',
                      border: primaryLoginIdentifier === LoginIdentifierType.CPF ? 'none' : '1.5px solid #cbd5e1',
                    }}>
                      {primaryLoginIdentifier === LoginIdentifierType.CPF && '✓'}
                    </div>
                  </div>

                  {/* Option 2: Username */}
                  <div
                    onClick={() => setPrimaryLoginIdentifier(LoginIdentifierType.USERNAME)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      border: primaryLoginIdentifier === LoginIdentifierType.USERNAME ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                      background: primaryLoginIdentifier === LoginIdentifierType.USERNAME ? '#f0f9ff' : '#f8fafc',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.15rem' }}>👤</span>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: primaryLoginIdentifier === LoginIdentifierType.USERNAME ? '#0369a1' : '#1e293b' }}>
                          {t('PLATFORM_SETTINGS_LOGIN_ID_USERNAME')}
                        </div>
                        <div style={{ fontSize: '0.70rem', color: '#64748b' }}>
                          {t('PLATFORM_SETTINGS_LOGIN_ID_USERNAME_DESC')}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      background: primaryLoginIdentifier === LoginIdentifierType.USERNAME ? '#0284c7' : '#ffffff',
                      color: '#ffffff',
                      border: primaryLoginIdentifier === LoginIdentifierType.USERNAME ? 'none' : '1.5px solid #cbd5e1',
                    }}>
                      {primaryLoginIdentifier === LoginIdentifierType.USERNAME && '✓'}
                    </div>
                  </div>

                  {/* Option 3: Email */}
                  <div
                    onClick={() => setPrimaryLoginIdentifier(LoginIdentifierType.EMAIL)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      border: primaryLoginIdentifier === LoginIdentifierType.EMAIL ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                      background: primaryLoginIdentifier === LoginIdentifierType.EMAIL ? '#f0f9ff' : '#f8fafc',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.15rem' }}>✉️</span>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: primaryLoginIdentifier === LoginIdentifierType.EMAIL ? '#0369a1' : '#1e293b' }}>
                          {t('PLATFORM_SETTINGS_LOGIN_ID_EMAIL')}
                        </div>
                        <div style={{ fontSize: '0.70rem', color: '#64748b' }}>
                          {t('PLATFORM_SETTINGS_LOGIN_ID_EMAIL_DESC')}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      background: primaryLoginIdentifier === LoginIdentifierType.EMAIL ? '#0284c7' : '#ffffff',
                      color: '#ffffff',
                      border: primaryLoginIdentifier === LoginIdentifierType.EMAIL ? 'none' : '1.5px solid #cbd5e1',
                    }}>
                      {primaryLoginIdentifier === LoginIdentifierType.EMAIL && '✓'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 2 (Right Sibling): Criação de Usuários & MFA */}
              <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                  🛡️ {t('PLATFORM_SETTINGS_BOX_USER_CREATION_MFA')}
                </h3>

                <div style={{
                  padding: '16px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                  flex: 1,
                }}>
                  {/* Top: Permitir Criação Direta de Usuários */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.15rem' }}>👤</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                          {t('PLATFORM_SETTINGS_ALLOW_DIRECT_USER_CREATION_LABEL')}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                        {t('PLATFORM_SETTINGS_ALLOW_DIRECT_USER_CREATION_HINT')}
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={allowDirectUserCreation}
                      onChange={(val: boolean) => setAllowDirectUserCreation(val)}
                      activeText={t('GLOBAL_STATUS_ACTIVE')}
                      inactiveText={t('GLOBAL_STATUS_INACTIVE')}
                    />
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: '1px solid #e2e8f0' }} />

                  {/* Bottom: Exigir Autenticação Multifator (MFA) Global */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.15rem' }}>🛡️</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                          {t('PLATFORM_SETTINGS_FIELD_MFA')}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                        {t('PLATFORM_SETTINGS_FIELD_MFA_DESC')}
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={mfaEnabled}
                      disabled
                      onChange={() => {}}
                      activeText={t('GLOBAL_STATUS_ACTIVE')}
                      inactiveText={t('GLOBAL_STATUS_INACTIVE')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2-Column Grid: Session Policies (Left) & Password Complexity (Right) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 18, alignItems: 'stretch' }}>
              {/* Left Column: Políticas de Sessão, Bloqueio & Recuperação */}
              <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>⏱️</span>
                  <span>Políticas de Sessão, Bloqueio & Recuperação</span>
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  {/* 1: Max Attempts */}
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <FieldLabel
                      label={t('PLATFORM_SETTINGS_FIELD_MAX_ATTEMPTS')}
                      tooltip={t('PLATFORM_SETTINGS_MAX_ATTEMPTS_HINT')}
                    />
                    <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={maxLoginAttempts}
                          onChange={(e) => setMaxLoginAttempts(Math.min(20, Math.max(1, Number(e.target.value.slice(0, 2)))))}
                          style={{ width: 50, padding: '6px 8px', border: 'none', textAlign: 'center', fontSize: '0.84rem', fontWeight: 600, outline: 'none' }}
                        />
                        <span style={{ background: '#f8fafc', padding: '6px 8px', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, borderLeft: '1px solid #e2e8f0' }}>
                          {t('PLATFORM_SETTINGS_ATTEMPTS_UNIT')}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: 4 }}>{t('PLATFORM_SETTINGS_ATTEMPTS_RANGE')}</span>
                    </div>
                  </div>

                  {/* 2: Lockout Duration */}
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <FieldLabel
                      label={t('PLATFORM_SETTINGS_FIELD_LOCKOUT_DURATION')}
                      tooltip={t('PLATFORM_SETTINGS_LOCKOUT_HINT')}
                    />
                    <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          value={lockoutDuration}
                          onChange={(e) => setLockoutDuration(Math.min(1440, Math.max(1, Number(e.target.value.slice(0, 4)))))}
                          style={{ width: 58, padding: '6px 8px', border: 'none', textAlign: 'center', fontSize: '0.84rem', fontWeight: 600, outline: 'none' }}
                        />
                        <span style={{ background: '#f8fafc', padding: '6px 8px', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, borderLeft: '1px solid #e2e8f0' }}>
                          {t('PLATFORM_SETTINGS_MINUTES_UNIT')}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: 4 }}>{t('PLATFORM_SETTINGS_LOCKOUT_RANGE')}</span>
                    </div>
                  </div>

                  {/* 3: Session Timeout */}
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <FieldLabel
                      label={t('PLATFORM_SETTINGS_FIELD_SESSION_TIMEOUT')}
                      tooltip={t('PLATFORM_SETTINGS_SESSION_TIMEOUT_HINT')}
                    />
                    <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                        <input
                          type="number"
                          min="5"
                          max="1440"
                          value={sessionTimeout}
                          onChange={(e) => setSessionTimeout(Math.min(1440, Math.max(5, Number(e.target.value.slice(0, 4)))))}
                          style={{ width: 58, padding: '6px 8px', border: 'none', textAlign: 'center', fontSize: '0.84rem', fontWeight: 600, outline: 'none' }}
                        />
                        <span style={{ background: '#f8fafc', padding: '6px 8px', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, borderLeft: '1px solid #e2e8f0' }}>
                          {t('PLATFORM_SETTINGS_MINUTES_UNIT')}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: 4 }}>{t('PLATFORM_SETTINGS_SESSION_RANGE')}</span>
                    </div>
                  </div>

                  {/* 4: Reset Token TTL */}
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <FieldLabel
                      label={t('PLATFORM_SETTINGS_FIELD_RESET_TTL')}
                      tooltip={t('PLATFORM_SETTINGS_RESET_TTL_HINT')}
                    />
                    <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                        <input
                          type="number"
                          min="1"
                          max="168"
                          value={resetTokenTtl}
                          onChange={(e) => setResetTokenTtl(Math.min(168, Math.max(1, Number(e.target.value.slice(0, 3)))))}
                          style={{ width: 50, padding: '6px 8px', border: 'none', textAlign: 'center', fontSize: '0.84rem', fontWeight: 600, outline: 'none' }}
                        />
                        <span style={{ background: '#f8fafc', padding: '6px 8px', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, borderLeft: '1px solid #e2e8f0' }}>
                          {t('PLATFORM_SETTINGS_HOURS_UNIT')}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: 4 }}>{t('PLATFORM_SETTINGS_RESET_TTL_RANGE')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Senhas */}
              <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🔑</span>
                  <span>{t('PLATFORM_SETTINGS_PWD_POLICY_TITLE')}</span>
                </h3>

                {/* Min Length */}
                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <FieldLabel
                    label={t('PLATFORM_SETTINGS_FIELD_MIN_PASS_LEN')}
                    style={{ marginBottom: 0 }}
                  />
                  <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                    <input
                      type="number"
                      min={8}
                      max={32}
                      value={minPasswordLength || ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setMinPasswordLength(raw === '' ? 0 : Number(raw.slice(0, 2)));
                      }}
                      onBlur={() => setMinPasswordLength((prev) => Math.min(32, Math.max(8, prev || 8)))}
                      style={{ width: 50, padding: '5px 8px', border: 'none', textAlign: 'center', fontSize: '0.84rem', fontWeight: 600, outline: 'none' }}
                    />
                    <span style={{ background: '#f8fafc', padding: '5px 8px', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, borderLeft: '1px solid #e2e8f0' }}>
                      {t('PLATFORM_SETTINGS_CHARS_UNIT')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Governance & Auditing */}
        {activeTab === 'governance' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 18, alignItems: 'stretch' }}>
            {/* Left Column: Arquitetura e Auditoria */}
            <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🏛️</span>
                <span>{t('PLATFORM_SETTINGS_CARD_ARCH_AUDIT')}</span>
              </h3>

              {/* Tenancy Architecture Selection */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a' }}>
                    {t('PLATFORM_SETTINGS_TENANCY_MODE_LABEL')}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                    {t('PLATFORM_SETTINGS_TENANCY_MODE_DESC')}
                  </div>
                </div>

                {/* Segmented Switch: Mono vs Multi with hover titles */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: '#f1f5f9',
                    borderRadius: 30,
                    padding: 4,
                    gap: 4,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <button
                    type="button"
                    title={t('PLATFORM_SETTINGS_MODE_MONO') + ': ' + t('PLATFORM_SETTINGS_TENANCY_MODE_DESC')}
                    onClick={() => setIsMultiTenant(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 16px',
                      borderRadius: 24,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.80rem',
                      fontWeight: !isMultiTenant ? 700 : 500,
                      color: !isMultiTenant ? '#0369a1' : '#64748b',
                      background: !isMultiTenant ? '#ffffff' : 'transparent',
                      boxShadow: !isMultiTenant ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span>🏢</span>
                    <span>{t('PLATFORM_SETTINGS_MODE_MONO')}</span>
                  </button>

                  <button
                    type="button"
                    title={t('PLATFORM_SETTINGS_MODE_MULTI') + ': ' + t('PLATFORM_SETTINGS_TENANCY_MODE_DESC')}
                    onClick={() => setIsMultiTenant(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 16px',
                      borderRadius: 24,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.80rem',
                      fontWeight: isMultiTenant ? 700 : 500,
                      color: isMultiTenant ? '#0369a1' : '#64748b',
                      background: isMultiTenant ? '#ffffff' : 'transparent',
                      boxShadow: isMultiTenant ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span>🌐</span>
                    <span>{t('PLATFORM_SETTINGS_MODE_MULTI')}</span>
                  </button>
                </div>
              </div>

              {/* Audit Retention */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <FieldLabel
                  label={t('PLATFORM_SETTINGS_FIELD_AUDIT_RETENTION')}
                  tooltip={t('PLATFORM_SETTINGS_AUDIT_RETENTION_HINT')}
                />
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    background: '#fff',
                    overflow: 'hidden',
                    marginTop: 4,
                  }}
                >
                  <input
                    type="number"
                    min={30}
                    max={3650}
                    step={1}
                    value={auditRetentionDays}
                    onChange={(e) => setAuditRetentionDays(Number(e.target.value.slice(0, 4)))}
                    style={{
                      width: 70,
                      padding: '6px 8px',
                      border: 'none',
                      outline: 'none',
                      fontSize: '0.84rem',
                      textAlign: 'center',
                      fontWeight: 600,
                      color: '#0f172a',
                    }}
                  />
                  <span style={{ background: '#f8fafc', padding: '6px 10px', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, borderLeft: '1px solid #e2e8f0' }}>
                    {t('PLATFORM_SETTINGS_DAYS_UNIT')}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Languages & Regionalization Card */}
            <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🌍</span>
                  <span>{t('PLATFORM_SETTINGS_ACTIVE_LANGUAGES')}</span>
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                  {t('PLATFORM_SETTINGS_ACTIVE_LANGUAGES_DESC')}
                </p>
              </div>

              {/* Structured Vertical List of Active Languages */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {availableLocales.map((loc) => {
                  const isChecked = supportedLocales.includes(loc);
                  const isDefault = defaultLocale === loc;
                  const meta = getLocaleMetadata(loc);
                  const langLabel = t(meta.labelKey as TranslationKey) || meta.nativeName;

                  return (
                    <div
                      key={loc}
                      onClick={() => handleToggleLocale(loc)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: isChecked ? '1.5px solid #38bdf8' : '1px solid #e2e8f0',
                        background: isChecked ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isChecked ? '0 1px 3px rgba(2, 132, 199, 0.08)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled on parent container
                          style={{ width: 16, height: 16, accentColor: '#0284c7', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{meta.flag}</span>
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: isChecked ? '#0f172a' : '#64748b' }}>
                            {langLabel}
                          </div>
                          <div style={{ fontSize: '0.70rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {loc}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isDefault && (
                          <span
                            style={{
                              fontSize: '0.70rem',
                              fontWeight: 700,
                              background: '#e0f2fe',
                              color: '#0369a1',
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: '1px solid #bae6fd',
                            }}
                          >
                            ★ {t('PLATFORM_SETTINGS_LANG_IS_DEFAULT')}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '0.70rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: isChecked ? '#dcfce7' : '#f1f5f9',
                            color: isChecked ? '#15803d' : '#94a3b8',
                          }}
                        >
                          {isChecked
                            ? t('PLATFORM_SETTINGS_LANG_STATUS_ACTIVE')
                            : t('PLATFORM_SETTINGS_LANG_STATUS_INACTIVE')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Regional: Timezone, Dialing Code, Default Locale */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                <div>
                  <FieldLabel
                    label={t('PLATFORM_SETTINGS_FIELD_DEFAULT_LOCALE')}
                    tooltip={t('PLATFORM_SETTINGS_DEFAULT_LOCALE_HINT')}
                  />
                  <select
                    value={defaultLocale}
                    onChange={(e) => setDefaultLocale(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
                  >
                    {availableLocales
                      .filter((loc) => supportedLocales.includes(loc))
                      .map((loc) => {
                        const meta = getLocaleMetadata(loc);
                        const langLabel = t(meta.labelKey as TranslationKey) || meta.nativeName;
                        return (
                          <option key={loc} value={loc}>
                            {meta.flag} {langLabel}
                          </option>
                        );
                      })}
                  </select>
                </div>

                <div>
                  <FieldLabel
                    label={t('PLATFORM_SETTINGS_FIELD_DEFAULT_TIMEZONE')}
                    tooltip={t('PLATFORM_SETTINGS_TIMEZONE_HINT')}
                  />
                  <select
                    value={defaultTimezone}
                    onChange={(e) => setDefaultTimezone(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
                  >
                    <option value="America/Sao_Paulo">America/Sao_Paulo (UTC-3)</option>
                    <option value="America/Manaus">America/Manaus (UTC-4)</option>
                    <option value="America/Belem">America/Belem (UTC-3)</option>
                    <option value="UTC">UTC (Universal Time)</option>
                  </select>
                </div>

                <div>
                  <FieldLabel
                    label={t('PLATFORM_SETTINGS_FIELD_DIALING_CODE')}
                    tooltip={t('PLATFORM_SETTINGS_DIALING_CODE_HINT')}
                  />
                  <input
                    type="text"
                    maxLength={5}
                    placeholder={t('PLATFORM_SETTINGS_DIALING_CODE_PLACEHOLDER')}
                    value={defaultDialingCode}
                    onChange={handleDialingCodeChange}
                    style={{
                      width: 80,
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: dialingCodeError ? '1.5px solid #e11d48' : '1px solid #cbd5e1',
                      fontSize: '0.82rem',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      color: dialingCodeError ? '#e11d48' : '#0f172a',
                      background: dialingCodeError ? '#fff1f2' : '#ffffff',
                    }}
                  />
                  {dialingCodeError && (
                    <div style={{ fontSize: '0.70rem', color: '#e11d48', marginTop: 4 }}>
                      {dialingCodeError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            type="submit"
            disabled={saving || Boolean(dialingCodeError)}
            style={{
              padding: '10px 24px',
              borderRadius: 6,
              background: saving || dialingCodeError ? '#94a3b8' : '#0284c7',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              cursor: saving || dialingCodeError ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {saving ? `⏳ ${t('GLOBAL_LABEL_SAVING')}` : `💾 ${t('GLOBAL_BTN_SAVE')}`}
          </button>
        </div>
      </form>
    </div>
  );
};
