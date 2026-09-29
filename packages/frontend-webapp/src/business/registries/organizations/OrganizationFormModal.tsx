import React, { useState, useMemo, useEffect } from 'react';
import { useI18n } from '../../../i18n/index.js';
import {
  Cnpj,
  Cep,
  Phone,
  Email,
  Uf,
  Country,
  Website,
  BRAZILIAN_UFS,
  BRAZILIAN_UF_NAMES,
} from '@openclinic/core/shared';
import { FieldLabelWithTooltip, ToggleSwitch } from '../../../arch/components/FormControls.js';
import { OrganizationHelpModal } from './OrganizationHelpModal.js';
import type { OrganizationData } from './types.js';

interface OrganizationFormModalProps {
  isOpen: boolean;
  initialData?: OrganizationData | null;
  onSave: (data: OrganizationData, autoCreateHeadquarters: boolean) => void;
  onClose: () => void;
  onNavigateToGeneralHelp?: () => void;
}

export const OrganizationFormModal: React.FC<OrganizationFormModalProps> = ({
  isOpen,
  initialData,
  onSave,
  onClose,
  onNavigateToGeneralHelp,
}) => {
  const { t } = useI18n();
  const isEditing = Boolean(initialData);

  const [formData, setFormData] = useState<Partial<OrganizationData>>({});
  const [autoCreateHeadquarters, setAutoCreateHeadquarters] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
      setAutoCreateHeadquarters(false);
    } else {
      setFormData({
        isActive: true,
        country: 'BRA',
      });
      setAutoCreateHeadquarters(true);
    }
    setErrors({});
    setTouched({});
    setIsSaving(false);
  }, [initialData, isOpen]);

  const countryOptions = useMemo(() => Country.getAllCountries(), []);

  const validateField = (field: string, val: unknown): string => {
    switch (field) {
      case 'legalName': {
        const trimmed = typeof val === 'string' ? val.trim() : '';
        if (!trimmed) return t('VALIDATION_ERROR_REQUIRED');
        if (trimmed.length < 2 || trimmed.length > 150) return t('VALIDATION_ERROR_NAME_INVALID');
        return '';
      }
      case 'tradeName': {
        const trimmed = typeof val === 'string' ? val.trim() : '';
        if (!trimmed) return t('VALIDATION_ERROR_REQUIRED');
        if (trimmed.length < 2 || trimmed.length > 150) return t('VALIDATION_ERROR_NAME_INVALID');
        return '';
      }
      case 'cnpj': {
        const trimmed = typeof val === 'string' ? val.trim() : '';
        if (!trimmed) return t('VALIDATION_ERROR_REQUIRED');
        const cleaned = Cnpj.clean(trimmed);
        if (!Cnpj.isValid(cleaned)) return t(Cnpj.ERROR_CODE);
        return '';
      }
      case 'taxId': {
        const trimmed = typeof val === 'string' ? val.trim() : '';
        if (trimmed && trimmed.length > 30) return t('VALIDATION_ERROR_TAX_ID_INVALID');
        return '';
      }
      case 'phone': {
        const trimmed = typeof val === 'string' ? val.trim() : '';
        if (trimmed) {
          const cleaned = Phone.clean(trimmed);
          if (!Phone.isValid(cleaned)) return t(Phone.ERROR_CODE);
        }
        return '';
      }
      case 'email': {
        const trimmed = typeof val === 'string' ? val.trim() : '';
        if (trimmed && !Email.isValid(trimmed)) return t(Email.ERROR_CODE);
        return '';
      }
      case 'website': {
        const trimmed = typeof val === 'string' ? val.trim() : '';
        if (trimmed && !Website.isValid(trimmed)) return t(Website.ERROR_CODE);
        return '';
      }
      case 'postalCode': {
        const trimmed = typeof val === 'string' ? val.trim() : '';
        if (trimmed) {
          const cleaned = Cep.clean(trimmed);
          if (!Cep.isValid(cleaned)) return t(Cep.ERROR_CODE);
        }
        return '';
      }
      case 'state': {
        const trimmed = typeof val === 'string' ? val.trim().toUpperCase() : '';
        if (trimmed && !Uf.isValid(trimmed)) return t(Uf.ERROR_CODE);
        return '';
      }
      default:
        return '';
    }
  };

  const validateAll = (): boolean => {
    const newErrors: Record<string, string> = {};

    const legalErr = validateField('legalName', formData.legalName);
    if (legalErr) newErrors.legalName = legalErr;

    const tradeErr = validateField('tradeName', formData.tradeName);
    if (tradeErr) newErrors.tradeName = tradeErr;

    const cnpjErr = validateField('cnpj', formData.cnpj);
    if (cnpjErr) newErrors.cnpj = cnpjErr;

    if (formData.taxId) {
      const taxErr = validateField('taxId', formData.taxId);
      if (taxErr) newErrors.taxId = taxErr;
    }
    if (formData.phone) {
      const phoneErr = validateField('phone', formData.phone);
      if (phoneErr) newErrors.phone = phoneErr;
    }
    if (formData.email) {
      const emailErr = validateField('email', formData.email);
      if (emailErr) newErrors.email = emailErr;
    }
    if (formData.website) {
      const webErr = validateField('website', formData.website);
      if (webErr) newErrors.website = webErr;
    }
    if (formData.postalCode) {
      const cepErr = validateField('postalCode', formData.postalCode);
      if (cepErr) newErrors.postalCode = cepErr;
    }
    if (formData.state) {
      const stateErr = validateField('state', formData.state);
      if (stateErr) newErrors.state = stateErr;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: keyof OrganizationData, val: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    if (errors[field]) {
      const err = validateField(field as string, val);
      if (!err) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    }
  };

  const handleBlur = (field: keyof OrganizationData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field as string, formData[field]);
    setErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  const handleFetchCep = async () => {
    const rawCep = Cep.clean(formData.postalCode || '');
    if (rawCep.length !== 8) return;

    try {
      const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          setFormData((prev) => ({
            ...prev,
            street: data.logradouro || prev.street,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }));
        }
      }
    } catch {
      // Fallback silently if offline or blocked
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      legalName: true,
      tradeName: true,
      cnpj: true,
      phone: true,
      email: true,
      website: true,
      taxId: true,
      postalCode: true,
      state: true,
    });

    if (!validateAll()) {
      return;
    }

    setIsSaving(true);
    setTimeout(() => {
      const cleaned: OrganizationData = {
        id: initialData?.id || `org-${Date.now().toString(36)}`,
        legalName: (formData.legalName || '').trim(),
        tradeName: (formData.tradeName || '').trim(),
        taxId: formData.taxId?.trim() || undefined,
        cnpj: Cnpj.clean(formData.cnpj || ''),
        stateRegistration: formData.stateRegistration?.trim() || undefined,
        municipalRegistration: formData.municipalRegistration?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        phone: formData.phone ? Phone.clean(formData.phone) : undefined,
        website: formData.website ? Website.clean(formData.website) : undefined,
        postalCode: formData.postalCode ? Cep.clean(formData.postalCode) : undefined,
        street: formData.street?.trim() || undefined,
        number: formData.number?.trim() || undefined,
        complement: formData.complement?.trim() || undefined,
        neighborhood: formData.neighborhood?.trim() || undefined,
        city: formData.city?.trim() || undefined,
        state: formData.state?.trim().toUpperCase() || undefined,
        country: formData.country || 'BRA',
        isActive: Boolean(formData.isActive ?? true),
      };

      onSave(cleaned, !isEditing && autoCreateHeadquarters);
      setIsSaving(false);
    }, 200);
  };

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: 780,
          width: '100%',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* ── Top Header: Title + Help Button + Close Button ── */}
        <div
          style={{
            padding: '14px 22px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 2px', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              🏢 {isEditing ? t('ORG_MODAL_EDIT_TITLE') : t('ORG_MODAL_CREATE_TITLE')}
            </h3>
            <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b' }}>
              {t('ORG_CARD_CORPORATE_TITLE')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Help Button */}
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              style={{
                background: '#f0f9ff',
                color: '#0284c7',
                border: '1px solid #bae6fd',
                borderRadius: 6,
                padding: '4px 9px',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Guia de Ajuda: Organizações, EAS e Salas"
            >
              <span>❓</span>
              <span>Ajuda</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.2rem',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Form Body: Compact Layout without Placeholders ── */}
        <form
          noValidate
          onSubmit={handleSubmit}
          style={{
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '16px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Top Operational Settings: Status & Auto-provisioning Headquarters */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Status Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#1e293b' }}>
                  Status da Organização
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  {formData.isActive ?? true
                    ? 'Organização ativa na plataforma com todas as funcionalidades habilitadas'
                    : 'Organização inativa (operações suspensas para esta entidade corporativa)'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ToggleSwitch
                  checked={Boolean(formData.isActive ?? true)}
                  onChange={(val) => handleFieldChange('isActive', val)}
                  tooltipPosition="bottom"
                  tooltipAlign="right"
                  tooltip={
                    formData.isActive ?? true
                      ? t('ORG_STATUS_ACTIVE_TOOLTIP')
                      : t('ORG_STATUS_INACTIVE_TOOLTIP')
                  }
                />
              </div>
            </div>

            {/* Auto-create Headquarters when creating a new organization */}
            {!isEditing && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  paddingTop: 8,
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <input
                  type="checkbox"
                  id="auto-create-hq"
                  checked={autoCreateHeadquarters}
                  onChange={(e) => setAutoCreateHeadquarters(e.target.checked)}
                  style={{ marginTop: 2, accentColor: '#0284c7', width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="auto-create-hq" style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
                    {t('ORG_AUTO_CREATE_HEADQUARTERS_LABEL')}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 1 }}>
                    {t('ORG_AUTO_CREATE_HEADQUARTERS_HINT')}
                  </div>
                </label>
              </div>
            )}
          </div>
          {/* Section 1: Legal Identification */}
          <div
            style={{
              background: '#f8fafc',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#0284c7',
                textTransform: 'uppercase',
                marginBottom: 10,
                letterSpacing: '0.04em',
              }}
            >
              {t('ORG_SECTION_LEGAL')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_LEGAL_NAME_LABEL')}
                  required
                />
                <input
                  type="text"
                  value={formData.legalName || ''}
                  onChange={(e) => handleFieldChange('legalName', e.target.value)}
                  onBlur={() => handleBlur('legalName')}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: `1px solid ${errors.legalName ? '#ef4444' : '#cbd5e1'}`,
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
                {errors.legalName && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3 }}>{errors.legalName}</div>}
              </div>

              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_TRADE_NAME_LABEL')}
                  required
                />
                <input
                  type="text"
                  value={formData.tradeName || ''}
                  onChange={(e) => handleFieldChange('tradeName', e.target.value)}
                  onBlur={() => handleBlur('tradeName')}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: `1px solid ${errors.tradeName ? '#ef4444' : '#cbd5e1'}`,
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
                {errors.tradeName && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3 }}>{errors.tradeName}</div>}
              </div>

              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_CNPJ_LABEL')}
                  required
                />
                <input
                  type="text"
                  value={formData.cnpj ? Cnpj.format(formData.cnpj) : ''}
                  onChange={(e) => handleFieldChange('cnpj', Cnpj.clean(e.target.value))}
                  onBlur={() => handleBlur('cnpj')}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: `1px solid ${errors.cnpj ? '#ef4444' : '#cbd5e1'}`,
                    fontSize: '0.84rem',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                  }}
                />
                {errors.cnpj && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3 }}>{errors.cnpj}</div>}
              </div>

              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_TAX_ID_LABEL')}
                  tooltip={t('ORG_FIELD_TAX_ID_TOOLTIP')}
                  tooltipPosition="bottom"
                  tooltipAlign="right"
                />
                <input
                  type="text"
                  value={formData.taxId || ''}
                  onChange={(e) => handleFieldChange('taxId', e.target.value)}
                  onBlur={() => handleBlur('taxId')}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: `1px solid ${errors.taxId ? '#ef4444' : '#cbd5e1'}`,
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Fiscal Registrations */}
          <div
            style={{
              background: '#f8fafc',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#0284c7',
                textTransform: 'uppercase',
                marginBottom: 10,
                letterSpacing: '0.04em',
              }}
            >
              {t('ORG_SECTION_REGULATORY')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_STATE_REG_LABEL')}
                />
                <input
                  type="text"
                  value={formData.stateRegistration || ''}
                  onChange={(e) => handleFieldChange('stateRegistration', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_MUNICIPAL_REG_LABEL')}
                />
                <input
                  type="text"
                  value={formData.municipalRegistration || ''}
                  onChange={(e) => handleFieldChange('municipalRegistration', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Corporate Address */}
          <div
            style={{
              background: '#f8fafc',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#0284c7',
                textTransform: 'uppercase',
                marginBottom: 10,
                letterSpacing: '0.04em',
              }}
            >
              {t('ORG_SECTION_ADDRESS')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px', gap: 10, marginBottom: 10 }}>
              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_POSTAL_CODE_LABEL')}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    type="text"
                    value={formData.postalCode ? Cep.format(formData.postalCode) : ''}
                    onChange={(e) => handleFieldChange('postalCode', Cep.clean(e.target.value))}
                    onBlur={() => {
                      handleBlur('postalCode');
                      handleFetchCep();
                    }}
                    placeholder="00000-000"
                    maxLength={9}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: `1px solid ${errors.postalCode ? '#ef4444' : '#cbd5e1'}`,
                      fontSize: '0.84rem',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleFetchCep}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '0 8px',
                      cursor: 'pointer',
                      fontSize: '0.76rem',
                    }}
                    title="Buscar CEP"
                  >
                    🔍
                  </button>
                </div>
              </div>

              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_STREET_LABEL')}
                />
                <input
                  type="text"
                  value={formData.street || ''}
                  onChange={(e) => handleFieldChange('street', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_NUMBER_LABEL')}
                />
                <input
                  type="text"
                  value={formData.number || ''}
                  onChange={(e) => handleFieldChange('number', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 90px', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  {t('ORG_FIELD_COMPLEMENT_LABEL')}
                </label>
                <input
                  type="text"
                  value={formData.complement || ''}
                  onChange={(e) => handleFieldChange('complement', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_NEIGHBORHOOD_LABEL')}
                />
                <input
                  type="text"
                  value={formData.neighborhood || ''}
                  onChange={(e) => handleFieldChange('neighborhood', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_CITY_LABEL')}
                />
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => handleFieldChange('city', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_STATE_LABEL')}
                />
                <select
                  value={formData.state || ''}
                  onChange={(e) => handleFieldChange('state', e.target.value)}
                  onBlur={() => handleBlur('state')}
                  style={{
                    width: '100%',
                    padding: '7px 8px',
                    borderRadius: 6,
                    border: `1px solid ${errors.state ? '#ef4444' : '#cbd5e1'}`,
                    fontSize: '0.84rem',
                    background: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">UF...</option>
                  {BRAZILIAN_UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Communication Channels */}
          <div
            style={{
              background: '#f8fafc',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#0284c7',
                textTransform: 'uppercase',
                marginBottom: 10,
                letterSpacing: '0.04em',
              }}
            >
              {t('ORG_SECTION_CONTACT')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_PHONE_LABEL')}
                />
                <input
                  type="text"
                  value={formData.phone ? Phone.format(formData.phone) : ''}
                  onChange={(e) => handleFieldChange('phone', Phone.clean(e.target.value))}
                  onBlur={() => handleBlur('phone')}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: `1px solid ${errors.phone ? '#ef4444' : '#cbd5e1'}`,
                    fontSize: '0.84rem',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_EMAIL_LABEL')}
                />
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: `1px solid ${errors.email ? '#ef4444' : '#cbd5e1'}`,
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <FieldLabelWithTooltip
                  label={t('ORG_FIELD_WEBSITE_LABEL')}
                />
                <input
                  type="text"
                  value={formData.website || ''}
                  onChange={(e) => handleFieldChange('website', e.target.value)}
                  onBlur={() => handleBlur('website')}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: `1px solid ${errors.website ? '#ef4444' : '#cbd5e1'}`,
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              paddingTop: 10,
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '7px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              {t('GLOBAL_BTN_CANCEL')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                background: isSaving ? '#94a3b8' : '#0284c7',
                border: 'none',
                borderRadius: 6,
                padding: '7px 18px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#ffffff',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: isSaving ? 'none' : '0 1px 2px rgba(2, 132, 199, 0.2)',
              }}
            >
              <span>💾</span>
              <span>{isSaving ? t('GLOBAL_LABEL_SAVING') : t('GLOBAL_BTN_SAVE')}</span>
            </button>
          </div>
        </form>
      </div>

      <OrganizationHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        onNavigateToGeneralHelp={onNavigateToGeneralHelp}
      />
    </div>
  );
};
export default OrganizationFormModal;
