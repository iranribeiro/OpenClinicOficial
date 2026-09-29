import React, { useState, useEffect } from 'react';
import { UserRole, Name, Email, Phone } from '@openclinic/core/shared';
import { useI18n } from '../../i18n/index.js';
import {
  getCurrentApplicationConfig,
  updateCurrentApplicationConfig,
  type TenantApplicationConfigResponse,
} from '../../services/api.js';
import { useToast } from '../../context/ToastContext.js';
import type { UserProfile } from '../types/auth.js';

export interface ApplicationSettingsViewProps {
  onNavigateTab?: (tab: string) => void;
  user?: UserProfile | null;
}

export const ApplicationSettingsView: React.FC<ApplicationSettingsViewProps> = ({
  onNavigateTab,
  user,
}) => {
  const { t } = useI18n();

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'governance' | 'support'>('overview');
  const { toast } = useToast();

  // Application Data & Config
  const [data, setData] = useState<TenantApplicationConfigResponse | null>(null);

  // Form State (System Configuration - ADMIN Role)
  const [supportContactName, setSupportContactName] = useState<string>('');
  const [supportPhone, setSupportPhone] = useState<string>('');
  const [supportEmail, setSupportEmail] = useState<string>('');
  const [enforceTerms, setEnforceTerms] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Validation Errors & Touched State
  const [errors, setErrors] = useState<{
    supportContactName?: string;
    supportPhone?: string;
    supportEmail?: string;
  }>({});
  const [touched, setTouched] = useState<{
    supportContactName?: boolean;
    supportPhone?: boolean;
    supportEmail?: boolean;
  }>({});

  // Deactivation Security Confirmation Modal State
  const [showDeactivateModal, setShowDeactivateModal] = useState<boolean>(false);
  const [deactivationReason, setDeactivationReason] = useState<string>('');
  const [confirmationCredential, setConfirmationCredential] = useState<string>('');
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivationAuditData, setDeactivationAuditData] = useState<{
    deactivatedAt?: string;
    deactivatedBy?: string;
    reason?: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getCurrentApplicationConfig();
      setData(res);

      const cfg = (res.config.configJson || {}) as Record<string, unknown>;

      setSupportContactName(String(cfg.supportContactName || cfg.support_contact_name || ''));
      setSupportPhone(Phone.format(String(cfg.supportPhone || cfg.support_phone || cfg.contactPhone || '')));
      setSupportEmail(String(cfg.supportEmail || cfg.support_email || cfg.contactEmail || ''));

      setEnforceTerms(Boolean(res.config.enforceDocumentAcceptanceOnLogin));
      setIsActive(Boolean(res.config.isActive));
      if (cfg.deactivationAudit && typeof cfg.deactivationAudit === 'object') {
        setDeactivationAuditData(cfg.deactivationAudit as { deactivatedAt?: string; deactivatedBy?: string; reason?: string });
      } else {
        setDeactivationAuditData(null);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '';
      toast.error(t('APP_SETTINGS_LOAD_ERROR') + (errMsg ? ` (${errMsg})` : ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const validateField = (field: 'supportContactName' | 'supportPhone' | 'supportEmail', val: string): string => {
    switch (field) {
      case 'supportContactName': {
        const trimmed = val.trim();
        if (!trimmed) return '';
        if (/^\d/.test(trimmed)) {
          return t('APP_SETTINGS_ERR_NAME');
        }
        if (!Name.isValid(trimmed)) {
          return t('APP_SETTINGS_ERR_NAME');
        }
        return '';
      }
      case 'supportPhone': {
        const cleaned = Phone.clean(val);
        if (!cleaned) return '';
        if (!Phone.isValid(cleaned)) {
          return t('APP_SETTINGS_ERR_PHONE');
        }
        return '';
      }
      case 'supportEmail': {
        const trimmed = val.trim();
        if (!trimmed) return '';
        if (!Email.isValid(trimmed)) {
          return t('APP_SETTINGS_ERR_EMAIL');
        }
        return '';
      }
      default:
        return '';
    }
  };

  const handleNameChange = (val: string) => {
    setSupportContactName(val);
    const trimmed = val.trim();
    if (trimmed && /^\d/.test(trimmed)) {
      setErrors((prev) => ({ ...prev, supportContactName: t('APP_SETTINGS_ERR_NAME') }));
    } else if (touched.supportContactName || errors.supportContactName) {
      const err = validateField('supportContactName', val);
      setErrors((prev) => ({ ...prev, supportContactName: err || undefined }));
    }
  };

  const handleNameBlur = () => {
    setTouched((prev) => ({ ...prev, supportContactName: true }));
    const err = validateField('supportContactName', supportContactName);
    setErrors((prev) => ({ ...prev, supportContactName: err || undefined }));
  };

  const handlePhoneChange = (val: string) => {
    const formatted = Phone.format(val);
    setSupportPhone(formatted);
    if (errors.supportPhone) {
      const err = validateField('supportPhone', formatted);
      if (!err) {
        setErrors((prev) => ({ ...prev, supportPhone: undefined }));
      }
    }
  };

  const handlePhoneBlur = () => {
    setTouched((prev) => ({ ...prev, supportPhone: true }));
    const err = validateField('supportPhone', supportPhone);
    setErrors((prev) => ({ ...prev, supportPhone: err || undefined }));
  };

  const handleEmailChange = (val: string) => {
    setSupportEmail(val);
    if (errors.supportEmail) {
      const err = validateField('supportEmail', val);
      if (!err) {
        setErrors((prev) => ({ ...prev, supportEmail: undefined }));
      }
    }
  };

  const handleEmailBlur = () => {
    setTouched((prev) => ({ ...prev, supportEmail: true }));
    const err = validateField('supportEmail', supportEmail);
    setErrors((prev) => ({ ...prev, supportEmail: err || undefined }));
  };

  const validate = (): boolean => {
    setTouched({
      supportContactName: true,
      supportPhone: true,
      supportEmail: true,
    });

    const newErrors: typeof errors = {};

    const nameErr = validateField('supportContactName', supportContactName);
    if (nameErr) newErrors.supportContactName = nameErr;

    const phoneErr = validateField('supportPhone', supportPhone);
    if (phoneErr) newErrors.supportPhone = phoneErr;

    const emailErr = validateField('supportEmail', supportEmail);
    if (emailErr) newErrors.supportEmail = emailErr;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleToggleActive = (checked: boolean) => {
    if (!checked) {
      setDeactivationReason('');
      setConfirmationCredential('');
      setDeactivateError(null);
      setShowDeactivateModal(true);
    } else {
      setIsActive(true);
      setDeactivationAuditData(null);
      toast.success(t('APP_SETTINGS_REACTIVATED_FEEDBACK'));
    }
  };

  const handleConfirmDeactivation = () => {
    const reasonTrim = deactivationReason.trim();
    if (reasonTrim.length < 15) {
      setDeactivateError(t('APP_SETTINGS_DEACTIVATE_ERR_REASON'));
      return;
    }

    const inputTrim = confirmationCredential.trim().toLowerCase();
    const userEmail = (user?.email || '').trim().toLowerCase();
    const userUsername = (user?.username || '').trim().toLowerCase();
    const cleanInputDigits = inputTrim.replace(/\D/g, '');

    const matchesEmail = Boolean(userEmail && inputTrim === userEmail);
    const matchesUsername = Boolean(userUsername && inputTrim === userUsername);
    const matchesCpf = cleanInputDigits.length === 11;
    const isFallbackValid = !user && (Email.isValid(inputTrim) || inputTrim.length >= 3);

    if (!matchesEmail && !matchesUsername && !matchesCpf && !isFallbackValid) {
      setDeactivateError(t('APP_SETTINGS_DEACTIVATE_ERR_CREDENTIAL'));
      return;
    }

    const auditEntry = {
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: user?.username || user?.email || confirmationCredential.trim(),
      reason: reasonTrim,
    };

    setIsActive(false);
    setDeactivationAuditData(auditEntry);
    setShowDeactivateModal(false);
    toast.warning(t('APP_SETTINGS_DEACTIVATED_FEEDBACK'));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.warning(t('APP_SETTINGS_FORM_INVALID'));
      return;
    }

    try {
      setSaving(true);

      const existingConfigJson = (data?.config.configJson || {}) as Record<string, any>;

      const payload = {
        isActive,
        enforceDocumentAcceptanceOnLogin: enforceTerms,
        configJson: {
          ...existingConfigJson,
          supportContactName: Name.clean(supportContactName),
          supportPhone: Phone.format(supportPhone),
          supportEmail: Email.clean(supportEmail),
          deactivationAudit: !isActive && deactivationAuditData ? deactivationAuditData : null,
        },
      };

      await updateCurrentApplicationConfig(payload);
      toast.success(t('APP_SETTINGS_SAVED_SUCCESS'));
      await loadData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '';
      toast.error(t('APP_SETTINGS_SAVE_ERROR') + (errMsg ? ` (${errMsg})` : ''));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 32, textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⏳</div>
        <div>{t('APP_SETTINGS_LOADING')}</div>
      </div>
    );
  }

  const app = data?.application;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Navigation Tabs Bar */}
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'overview' ? '1px solid #bae6fd' : '1px solid transparent',
              background: activeTab === 'overview' ? '#f0f9ff' : 'transparent',
              color: activeTab === 'overview' ? '#0284c7' : '#64748b',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📋</span>
            <span>{t('APP_SETTINGS_TAB_OVERVIEW')}</span>
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
            <span>🛡️</span>
            <span>{t('APP_SETTINGS_TAB_GOVERNANCE')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('support')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeTab === 'support' ? '1px solid #bae6fd' : '1px solid transparent',
              background: activeTab === 'support' ? '#f0f9ff' : 'transparent',
              color: activeTab === 'support' ? '#0284c7' : '#64748b',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>🎧</span>
            <span>{t('APP_SETTINGS_TAB_SUPPORT')}</span>
          </button>
        </div>

        {/* Status badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              background: isActive ? '#ecfdf5' : '#fef2f2',
              color: isActive ? '#059669' : '#dc2626',
              border: isActive ? '1px solid #a7f3d0' : '1px solid #fecaca',
              padding: '4px 10px',
              borderRadius: 14,
              fontSize: '0.74rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#10b981' : '#ef4444' }} />
            {isActive ? t('APP_SETTINGS_CARD_STATUS_ACTIVE') : t('APP_SETTINGS_CARD_STATUS_INACTIVE')}
          </span>
          <span
            style={{
              background: '#f8fafc',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              padding: '4px 10px',
              borderRadius: 14,
              fontSize: '0.74rem',
              fontWeight: 600,
            }}
          >
            {app?.isMultiTenant ? t('PLATFORM_SETTINGS_MODE_MULTI') : t('PLATFORM_SETTINGS_MODE_MONO')}
          </span>
        </div>
      </div>

      {/* Main Settings Form */}

      {/* System Settings Form */}
      <form onSubmit={handleSave}>
        {/* Tab 1: Overview & Identity */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* System Identity Hero Card */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {app?.appLogoUrl ? (
                    <img
                      src={app.appLogoUrl}
                      alt={app.appName}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        objectFit: 'contain',
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        padding: 4,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.75rem',
                        flexShrink: 0,
                      }}
                    >
                      🏥
                    </div>
                  )}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.30rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                        {app?.appName || 'OpenClinic'}
                      </span>
                      {app?.appVersion && (
                        <span
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                          }}
                        >
                          v{app.appVersion}
                        </span>
                      )}
                      <span
                        style={{
                          background: '#f8fafc',
                          color: '#475569',
                          border: '1px solid #e2e8f0',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: '0.74rem',
                          fontWeight: 600,
                        }}
                      >
                        {app?.isMultiTenant ? t('PLATFORM_SETTINGS_MODE_MULTI') : t('PLATFORM_SETTINGS_MODE_MONO')}
                      </span>
                    </div>
                    {app?.appSubtitle && (
                      <div style={{ fontSize: '0.86rem', color: '#64748b', marginTop: 4 }}>
                        {app.appSubtitle}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3-Column Structured Parameters Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {/* Card 1: Distribuição & Arquitetura */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                  <span style={{ fontSize: '1.1rem' }}>🏛️</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                    {t('APP_SETTINGS_CARD_TECH_DISTRIBUTION')}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>{t('APP_SETTINGS_CODE_LABEL')}</div>
                  <div style={{ fontFamily: 'monospace', color: '#0284c7', fontWeight: 600, fontSize: '0.84rem', marginTop: 2 }}>
                    {app?.code || 'openclinic_core'}
                  </div>
                </div>
                {app?.appDescription && (
                  <div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>{t('APP_SETTINGS_FIELD_DESCRIPTION')}</div>
                    <div style={{ color: '#334155', fontSize: '0.80rem', marginTop: 2, lineHeight: 1.4 }}>
                      {app.appDescription}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>Modo Arquitetural</div>
                  <div style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.84rem', marginTop: 2 }}>
                    {app?.isMultiTenant ? t('PLATFORM_SETTINGS_MODE_MULTI') : t('PLATFORM_SETTINGS_MODE_MONO')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>{t('APP_SETTINGS_PARTITIONING_LABEL')}</div>
                  <div style={{ color: '#334155', fontSize: '0.80rem', marginTop: 2 }}>
                    {t('APP_SETTINGS_PARTITIONING_VAL')}
                  </div>
                </div>
              </div>

              {/* Card 2: Regionalização & Localização */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                  <span style={{ fontSize: '1.1rem' }}>🌐</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                    {t('APP_SETTINGS_CARD_REGIONAL')}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>{t('APP_SETTINGS_FIELD_TIMEZONE')}</div>
                  <div style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.84rem', marginTop: 2 }}>
                    {app?.defaultTimezone || 'America/Sao_Paulo'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>{t('APP_SETTINGS_BASE_LOCALE')}</div>
                  <div style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.84rem', marginTop: 2 }}>
                    {app?.defaultLocale || 'pt-BR'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>Localidades Suportadas</div>
                  <div style={{ color: '#334155', fontSize: '0.80rem', marginTop: 2 }}>
                    {app?.defaultSupportedLocales?.join(', ') || 'pt-BR, en-US'}
                  </div>
                </div>
              </div>

              {/* Card 3: Governança do Tenant & IAM */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                  <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                    {t('APP_SETTINGS_CARD_TENANT_GOVERNANCE')}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>{t('APP_SETTINGS_TENANT_ADMIN_ROLE_LABEL')}</div>
                  <div style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.84rem', marginTop: 2 }}>
                    {user?.role === UserRole.OWNER ? 'Proprietário da Plataforma (OWNER)' : t('APP_SETTINGS_TENANT_ADMIN_ROLE_VAL')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>{t('APP_SETTINGS_TENANT_ISOLATION_LABEL')}</div>
                  <div style={{ color: '#334155', fontSize: '0.80rem', marginTop: 2 }}>
                    {user?.role === UserRole.OWNER ? 'Acesso irrestrito a todos os contratantes e à base global' : t('APP_SETTINGS_TENANT_ISOLATION_VAL')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>Status da Instância</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#10b981' : '#ef4444' }} />
                    <span style={{ fontWeight: 700, color: isActive ? '#065f46' : '#991b1b', fontSize: '0.84rem' }}>
                      {isActive ? t('APP_SETTINGS_CARD_STATUS_ACTIVE') : t('APP_SETTINGS_CARD_STATUS_INACTIVE')}
                    </span>
                  </div>
                </div>
              </div>
            </div>


          </div>
        )}

        {/* Tab 2: Governance & Instance */}
        {activeTab === 'governance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#fff', padding: '20px 22px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.94rem', fontWeight: 700, color: '#0f172a' }}>
                🛡️ {t('APP_SETTINGS_TAB_GOVERNANCE')}
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: '#64748b' }}>
                {t('APP_SETTINGS_GOVERNANCE_DESC')}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Switch de Termos de Uso / LGPD */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ maxWidth: 640 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
                      {t('APP_SETTINGS_ENFORCE_TERMS')}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3 }}>
                      {t('APP_SETTINGS_ENFORCE_TERMS_DESC')}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enforceTerms}
                    onChange={(e) => setEnforceTerms(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#0284c7', cursor: 'pointer' }}
                  />
                </label>

                {/* Operational Instance Activation Toggle */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 8,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
                        {t('APP_SETTINGS_INSTANCE_ACTIVE')}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3 }}>
                        {t('APP_SETTINGS_INSTANCE_ACTIVE_DESC')}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => handleToggleActive(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: '#0284c7', cursor: 'pointer' }}
                    />
                  </label>

                  {!isActive && deactivationAuditData && (
                    <div
                      style={{
                        background: '#fff1f2',
                        border: '1px solid #fecdd3',
                        borderRadius: 8,
                        padding: '12px 16px',
                        fontSize: '0.80rem',
                        color: '#9f1239',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>⚠️</span>
                        <span>Instância Inativa (Modo Manutenção)</span>
                      </div>
                      <div>
                        <strong>Desativado por:</strong> {deactivationAuditData.deactivatedBy || 'Administrador'} {deactivationAuditData.deactivatedAt ? `em ${new Date(deactivationAuditData.deactivatedAt).toLocaleString()}` : ''}
                      </div>
                      {deactivationAuditData.reason && (
                        <div>
                          <strong>Justificativa:</strong> {deactivationAuditData.reason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Technical Support Channels */}
        {activeTab === 'support' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#fff', padding: '20px 22px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🎧</span>
                    <span>{t('APP_SETTINGS_SECTION_SUPPORT')}</span>
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    {t('APP_SETTINGS_SUPPORT_DESC')}
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* Contact Person / Support Team Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    {t('APP_SETTINGS_FIELD_SUPPORT_NAME')}
                  </label>
                  <input
                    type="text"
                    maxLength={Name.MAX_LENGTH}
                    value={supportContactName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={handleNameBlur}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: errors.supportContactName ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                    }}
                  />
                  <span style={{ display: 'block', fontSize: '0.72rem', color: errors.supportContactName ? '#ef4444' : '#64748b', marginTop: 4 }}>
                    {errors.supportContactName || t('APP_SETTINGS_SUPPORT_NAME_HINT')}
                  </span>
                </div>

                {/* Telefone do Suporte */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    {t('APP_SETTINGS_FIELD_SUPPORT_PHONE')}
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="(00) 00000-0000"
                    value={supportPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onBlur={handlePhoneBlur}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: errors.supportPhone ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                      fontFamily: 'monospace',
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                    }}
                  />
                  <span style={{ display: 'block', fontSize: '0.72rem', color: errors.supportPhone ? '#ef4444' : '#64748b', marginTop: 4 }}>
                    {errors.supportPhone || t('APP_SETTINGS_SUPPORT_PHONE_HINT')}
                  </span>
                </div>

                {/* E-mail do Suporte */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    {t('APP_SETTINGS_FIELD_SUPPORT_EMAIL')}
                  </label>
                  <input
                    type="email"
                    maxLength={254}
                    value={supportEmail}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onBlur={handleEmailBlur}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: errors.supportEmail ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                    }}
                  />
                  <span style={{ display: 'block', fontSize: '0.72rem', color: errors.supportEmail ? '#ef4444' : '#64748b', marginTop: 4 }}>
                    {errors.supportEmail || t('APP_SETTINGS_SUPPORT_EMAIL_HINT')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Button Right-Aligned */}
        {activeTab !== 'overview' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '9px 22px',
                borderRadius: 6,
                background: saving ? '#94a3b8' : '#0284c7',
                color: '#fff',
                fontSize: '0.84rem',
                fontWeight: 600,
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)',
              }}
            >
              {saving ? `⏳ ${t('APP_SETTINGS_SAVING')}` : `💾 ${t('APP_SETTINGS_BTN_SAVE')}`}
            </button>
          </div>
        )}
      </form>

      {/* Deactivation Security Confirmation Modal */}
      {showDeactivateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              maxWidth: 540,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: '#fff1f2',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: '#ffe4e6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                }}
              >
                🛑
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#9f1239' }}>
                  {t('APP_SETTINGS_DEACTIVATE_MODAL_TITLE')}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#be123c', fontWeight: 500 }}>
                  Ação Crítica de Governança
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Warning Box */}
              <div
                style={{
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: 8,
                  padding: '12px 14px',
                  fontSize: '0.80rem',
                  color: '#9f1239',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {t('APP_SETTINGS_DEACTIVATE_WARNING')}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#be123c' }}>
                  {t('APP_SETTINGS_DEACTIVATE_NOTE')}
                </div>
              </div>

              {/* Justification Field */}
              <div>
                <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  {t('APP_SETTINGS_DEACTIVATE_REASON_LABEL')} *
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={deactivationReason}
                  onChange={(e) => {
                    setDeactivationReason(e.target.value);
                    if (deactivateError) setDeactivateError(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginTop: 3 }}>
                  <span>{t('APP_SETTINGS_DEACTIVATE_REASON_HINT')}</span>
                  <span>{deactivationReason.length}/500</span>
                </div>
              </div>

              {/* Admin Confirmation Credential Field */}
              <div>
                <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  {t('APP_SETTINGS_DEACTIVATE_CONFIRM_LABEL')} *
                </label>
                <input
                  type="text"
                  value={confirmationCredential}
                  onChange={(e) => {
                    setConfirmationCredential(e.target.value);
                    if (deactivateError) setDeactivateError(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    outline: 'none',
                  }}
                />
                <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginTop: 3 }}>
                  {t('APP_SETTINGS_DEACTIVATE_CONFIRM_HINT')} {user?.email ? `(${user.email})` : user?.username ? `(${user.username})` : ''}
                </span>
              </div>

              {/* Error message */}
              {deactivateError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 6,
                    padding: '8px 12px',
                    color: '#dc2626',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  ⚠️ {deactivateError}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #f1f5f9',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setShowDeactivateModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('APP_SETTINGS_DEACTIVATE_BTN_CANCEL')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivation}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#e11d48',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 1px 2px rgba(225, 29, 72, 0.3)',
                }}
              >
                <span>🛑</span>
                <span>{t('APP_SETTINGS_DEACTIVATE_BTN_CONFIRM')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
