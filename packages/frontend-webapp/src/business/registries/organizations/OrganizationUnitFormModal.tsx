import React, { useState, useMemo, useEffect } from 'react';
import { useI18n } from '../../../i18n/index.js';
import {
  Cnpj,
  Cnes,
  Cep,
  Phone,
  Email,
  Name,
  Uf,
  Country,
  BRAZILIAN_UFS,
  BRAZILIAN_UF_NAMES,
} from '@openclinic/core/shared';
import { FieldLabelWithTooltip, ToggleSwitch, Tooltip } from '../../../arch/components/FormControls.js';
import type { OrganizationData, OrganizationUnitData } from './types.js';

interface OrganizationUnitFormModalProps {
  isOpen: boolean;
  parentOrganization: OrganizationData;
  initialData?: OrganizationUnitData | null;
  onSave: (data: OrganizationUnitData) => void;
  onClose: () => void;
}

export const OrganizationUnitFormModal: React.FC<OrganizationUnitFormModalProps> = ({
  isOpen,
  parentOrganization,
  initialData,
  onSave,
  onClose,
}) => {
  const { t } = useI18n();
  const isEditing = Boolean(initialData);

  const [formData, setFormData] = useState<Partial<OrganizationUnitData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({
        organizationId: parentOrganization.id,
        isHeadquarters: false,
        isActive: true,
        country: 'BRA',
      });
    }
    setErrors({});
    setTouched({});
    setIsSaving(false);
    setCopiedFeedback(false);
  }, [initialData, parentOrganization, isOpen]);

  const countryOptions = useMemo(() => Country.getAllCountries(), []);

  const handleCopyFromParent = () => {
    setFormData((prev) => ({
      ...prev,
      street: parentOrganization.street,
      number: parentOrganization.number,
      complement: parentOrganization.complement,
      neighborhood: parentOrganization.neighborhood,
      city: parentOrganization.city,
      state: parentOrganization.state,
      country: parentOrganization.country || 'BRA',
      postalCode: parentOrganization.postalCode,
      phone: parentOrganization.phone,
      email: parentOrganization.email,
    }));
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 3000);
  };

  const validateField = (field: string, val: unknown): string => {
    switch (field) {
      case 'name': {
        const trimmed = typeof val === 'string' ? val.trim() : '';
        if (!trimmed) return t('VALIDATION_ERROR_REQUIRED');
        if (trimmed.length < 2 || trimmed.length > 150) return t('VALIDATION_ERROR_NAME_INVALID');
        return '';
      }
      case 'cnesCode': {
        const trimmed = typeof val === 'string' ? val.trim() : '';
        if (!trimmed) return t('VALIDATION_ERROR_REQUIRED');
        const cleaned = Cnes.clean(trimmed);
        if (!Cnes.isValid(cleaned)) return t(Cnes.ERROR_CODE);
        return '';
      }
      case 'cnpj': {
        const trimmed = typeof val === 'string' ? val.trim() : '';
        if (trimmed) {
          const cleaned = Cnpj.clean(trimmed);
          if (!Cnpj.isValid(cleaned)) return t(Cnpj.ERROR_CODE);
        }
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
    const nameErr = validateField('name', formData.name);
    if (nameErr) newErrors.name = nameErr;

    const cnesErr = validateField('cnesCode', formData.cnesCode);
    if (cnesErr) newErrors.cnesCode = cnesErr;

    if (formData.cnpj) {
      const cnpjErr = validateField('cnpj', formData.cnpj);
      if (cnpjErr) newErrors.cnpj = cnpjErr;
    }
    if (formData.phone) {
      const phoneErr = validateField('phone', formData.phone);
      if (phoneErr) newErrors.phone = phoneErr;
    }
    if (formData.email) {
      const emailErr = validateField('email', formData.email);
      if (emailErr) newErrors.email = emailErr;
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

  const handleFieldChange = (field: keyof OrganizationUnitData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      const err = validateField(field as string, value);
      if (!err) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field as string];
          return next;
        });
      }
    }
  };

  const handleBlur = (field: keyof OrganizationUnitData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field as string, formData[field]);
    setErrors((prev) => {
      const next = { ...prev };
      if (err) next[field as string] = err;
      else delete next[field as string];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      name: true,
      cnesCode: true,
      cnpj: true,
      phone: true,
      email: true,
      postalCode: true,
      state: true,
    });

    if (!validateAll()) return;

    setIsSaving(true);
    setTimeout(() => {
      const cleaned: OrganizationUnitData = {
        id: initialData?.id || `unit-${Date.now().toString(36)}`,
        organizationId: parentOrganization.id,
        name: Name.clean(formData.name || ''),
        tradeName: formData.tradeName?.trim() || undefined,
        cnesCode: Cnes.clean(formData.cnesCode || ''),
        cnpj: formData.cnpj ? Cnpj.clean(formData.cnpj) : undefined,
        taxId: formData.taxId?.trim() || undefined,
        phone: formData.phone ? Phone.clean(formData.phone) : undefined,
        email: formData.email?.trim() || undefined,
        postalCode: formData.postalCode ? Cep.clean(formData.postalCode) : undefined,
        street: formData.street?.trim() || undefined,
        number: formData.number?.trim() || undefined,
        complement: formData.complement?.trim() || undefined,
        neighborhood: formData.neighborhood?.trim() || undefined,
        city: formData.city?.trim() || undefined,
        state: formData.state?.trim().toUpperCase() || undefined,
        country: formData.country || 'BRA',
        isHeadquarters: Boolean(formData.isHeadquarters),
        isActive: Boolean(formData.isActive ?? true),
      };

      onSave(cleaned);
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
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: 820,
          width: '100%',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
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
              📍 {isEditing ? t('UNIT_MODAL_EDIT_TITLE') : t('UNIT_MODAL_CREATE_TITLE')}
            </h3>
            <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b' }}>
              {t('UNIT_PARENT_ORGANIZATION_LABEL')}: <strong style={{ color: '#0f172a' }}>{parentOrganization.tradeName}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.15rem',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Copy from Headquarters Action Banner (Shown only when creating a new unit) */}
        {!isEditing && (
          <>
            <div
              style={{
                padding: '8px 22px',
                background: '#eff6ff',
                borderBottom: '1px solid #dbeafe',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#1e40af' }}>
                🏢 Matriz: <strong>{parentOrganization.legalName}</strong> ({Cnpj.format(parentOrganization.cnpj)})
              </div>
              <button
                type="button"
                onClick={handleCopyFromParent}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#1d4ed8',
                  background: '#ffffff',
                  border: '1px solid #bfdbfe',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                }}
              >
                <span>📋</span>
                <span>{t('ORG_COPY_PARENT_DATA_BTN')}</span>
              </button>
            </div>

            {copiedFeedback && (
              <div
                style={{
                  padding: '6px 22px',
                  background: '#ecfdf5',
                  color: '#065f46',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  borderBottom: '1px solid #a7f3d0',
                }}
              >
                ✓ {t('ORG_COPY_PARENT_DATA_SUCCESS')}
              </div>
            )}
          </>
        )}

        {/* Form Body */}
        <form
          noValidate
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '14px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Top Operational Settings: Headquarters & Status */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              {/* Headquarters switch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⭐</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                    {t('UNIT_FIELD_IS_HEADQUARTERS_LABEL')}
                  </span>
                  <Tooltip content={t('UNIT_FIELD_IS_HEADQUARTERS_TOOLTIP')} position="bottom" align="left">
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={t('UNIT_FIELD_IS_HEADQUARTERS_TOOLTIP')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 15,
                        height: 15,
                        borderRadius: '50%',
                        background: '#e2e8f0',
                        color: '#475569',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        cursor: 'help',
                      }}
                    >
                      ℹ️
                    </span>
                  </Tooltip>
                </div>
                <ToggleSwitch
                  checked={Boolean(formData.isHeadquarters)}
                  onChange={(val) => handleFieldChange('isHeadquarters', val)}
                  activeText={t('GLOBAL_YES')}
                  inactiveText={t('GLOBAL_NO')}
                />
              </div>

              {/* Status toggle (ToggleSwitch renders active/inactive badge internally; no duplicate label) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Status:</span>
                <ToggleSwitch
                  checked={Boolean(formData.isActive ?? true)}
                  onChange={(val) => handleFieldChange('isActive', val)}
                  tooltipPosition="bottom"
                  tooltipAlign="right"
                  tooltip={
                    formData.isActive ?? true
                      ? t('UNIT_STATUS_ACTIVE_TOOLTIP')
                      : t('UNIT_STATUS_INACTIVE_TOOLTIP')
                  }
                />
              </div>
            </div>

            {/* Section 1: Identification */}
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                {t('UNIT_SECTION_IDENTIFICATION')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <FieldLabelWithTooltip
                    label={t('UNIT_FIELD_NAME_LABEL')}
                    required
                  />
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    onBlur={() => handleBlur('name')}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: `1px solid ${errors.name ? '#ef4444' : '#cbd5e1'}`,
                      fontSize: '0.84rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  {errors.name && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 2 }}>{errors.name}</div>}
                </div>

                <div>
                  <FieldLabelWithTooltip
                    label={t('UNIT_FIELD_TRADE_NAME_LABEL')}
                  />
                  <input
                    type="text"
                    value={formData.tradeName || ''}
                    onChange={(e) => handleFieldChange('tradeName', e.target.value)}
                    onBlur={() => handleBlur('tradeName')}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <FieldLabelWithTooltip
                    label={t('UNIT_FIELD_CNES_LABEL')}
                    tooltip={t('UNIT_FIELD_CNES_TOOLTIP')}
                    required
                  />
                  <input
                    type="text"
                    value={formData.cnesCode ? Cnes.format(formData.cnesCode) : ''}
                    onChange={(e) => handleFieldChange('cnesCode', Cnes.clean(e.target.value))}
                    onBlur={() => handleBlur('cnesCode')}
                    placeholder="0000000"
                    maxLength={7}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: `1px solid ${errors.cnesCode ? '#ef4444' : '#cbd5e1'}`,
                      fontSize: '0.84rem',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                    }}
                  />
                  {errors.cnesCode && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 2 }}>{errors.cnesCode}</div>}
                </div>

                <div>
                  <FieldLabelWithTooltip
                    label={t('UNIT_FIELD_CNPJ_LABEL')}
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
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: `1px solid ${errors.cnpj ? '#ef4444' : '#cbd5e1'}`,
                      fontSize: '0.84rem',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                    }}
                  />
                  {errors.cnpj && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 2 }}>{errors.cnpj}</div>}
                </div>
              </div>
            </div>

            {/* Section 2: Address */}
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                {t('UNIT_SECTION_ADDRESS')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 90px 140px', gap: 10, marginBottom: 10 }}>
                <div>
                  <FieldLabelWithTooltip
                    label={t('ORG_FIELD_POSTAL_CODE_LABEL')}
                  />
                  <input
                    type="text"
                    value={formData.postalCode ? Cep.format(formData.postalCode) : ''}
                    onChange={(e) => handleFieldChange('postalCode', Cep.clean(e.target.value))}
                    onBlur={() => handleBlur('postalCode')}
                    placeholder="00000-000"
                    maxLength={9}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: `1px solid ${errors.postalCode ? '#ef4444' : '#cbd5e1'}`,
                      fontSize: '0.84rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  {errors.postalCode && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 2 }}>{errors.postalCode}</div>}
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
                      padding: '6px 10px',
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
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

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
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px 130px', gap: 10 }}>
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
                      padding: '6px 10px',
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
                      padding: '6px 10px',
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
                      padding: '6px 8px',
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
                  {errors.state && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 2 }}>{errors.state}</div>}
                </div>

                <div>
                  <FieldLabelWithTooltip
                    label={t('ORG_FIELD_COUNTRY_LABEL')}
                  />
                  <select
                    value={formData.country || 'BRA'}
                    onChange={(e) => handleFieldChange('country', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                      background: '#ffffff',
                      boxSizing: 'border-box',
                    }}
                  >
                    {countryOptions.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Contacts */}
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                {t('UNIT_SECTION_CONTACT')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <FieldLabelWithTooltip
                    label={t('UNIT_FIELD_PHONE_LABEL')}
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
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: `1px solid ${errors.phone ? '#ef4444' : '#cbd5e1'}`,
                      fontSize: '0.84rem',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                    }}
                  />
                  {errors.phone && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 2 }}>{errors.phone}</div>}
                </div>

                <div>
                  <FieldLabelWithTooltip
                    label={t('UNIT_FIELD_EMAIL_LABEL')}
                  />
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    onBlur={() => handleBlur('email')}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: `1px solid ${errors.email ? '#ef4444' : '#cbd5e1'}`,
                      fontSize: '0.84rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  {errors.email && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 2 }}>{errors.email}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions (Pinned at bottom, never scrolled away) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              padding: '12px 22px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: 7,
                fontSize: '0.84rem',
                fontWeight: 600,
                color: '#475569',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
              }}
            >
              {t('GLOBAL_BTN_CANCEL')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '8px 24px',
                borderRadius: 7,
                fontSize: '0.84rem',
                fontWeight: 600,
                color: '#ffffff',
                background: isSaving ? '#94a3b8' : '#0284c7',
                border: 'none',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.6 : 1,
                boxShadow: isSaving ? 'none' : '0 1px 2px rgba(2, 132, 199, 0.2)',
              }}
            >
              {isSaving ? t('GLOBAL_LABEL_SAVING') : t('UNIT_BTN_SAVE')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
