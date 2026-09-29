import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../i18n/index.js';
import {
  type StaffItem,
  type CreateStaffPayload,
  type StaffQualificationItem,
  checkIdentityUniqueness,
} from '../../../services/api.js';
import { FieldLabelWithTooltip } from '../../../arch/components/FormControls.js';
import { Cpf, Email, Phone } from '@openclinic/core/shared';

export interface StaffDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CreateStaffPayload) => Promise<void>;
  initialData?: StaffItem | null;
  isSaving: boolean;
}

type TabKey = 'general' | 'employment' | 'qualifications';

const STAFF_TYPES = [
  { value: 'RECEPTIONIST', labelKey: 'FIELD_STAFF_TYPE_RECEPTIONIST' },
  { value: 'ADMINISTRATIVE', labelKey: 'FIELD_STAFF_TYPE_ADMINISTRATIVE' },
  { value: 'FINANCIAL', labelKey: 'FIELD_STAFF_TYPE_FINANCIAL' },
  { value: 'NURSE_TECH', labelKey: 'FIELD_STAFF_TYPE_NURSE_TECH' },
  { value: 'OTHER', labelKey: 'FIELD_STAFF_TYPE_OTHER' },
] as const;

const CONTRACT_TYPES = [
  { value: 'CLT', labelKey: 'FIELD_CONTRACT_CLT' },
  { value: 'PJ', labelKey: 'FIELD_CONTRACT_PJ' },
  { value: 'INTERN', labelKey: 'FIELD_CONTRACT_INTERN' },
  { value: 'TEMPORARY', labelKey: 'FIELD_CONTRACT_TEMPORARY' },
] as const;

export const StaffDetailModal: React.FC<StaffDetailModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  isSaving,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>('general');

  // Tab 1: Identification
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Tab 2: Employment & Role
  const [staffType, setStaffType] = useState('RECEPTIONIST');
  const [department, setDepartment] = useState('Recepção e Atendimento');
  const [jobTitle, setJobTitle] = useState('Recepcionista');
  const [contractType, setContractType] = useState('CLT');
  const [admissionDate, setAdmissionDate] = useState('');

  // Tab 3: Qualifications & Trainings
  const [qualifications, setQualifications] = useState<StaffQualificationItem[]>([]);

  // Validation & onBlur tracking
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showSaveHint, setShowSaveHint] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.full_name || '');
      setUsername(initialData.username || (initialData.email ? initialData.email.split('@')[0] : ''));
      setCpf(initialData.cpf ? Cpf.format(initialData.cpf) : '');
      setEmail(initialData.email || '');
      setPhone(initialData.phone ? Phone.format(initialData.phone) : '');
      setNotes(initialData.notes || '');
      setStaffType(initialData.staff_type || 'RECEPTIONIST');
      setDepartment(initialData.department || '');
      setJobTitle(initialData.job_title || '');
      setContractType(initialData.contract_type || 'CLT');
      setAdmissionDate(initialData.admission_date ? initialData.admission_date.slice(0, 10) : '');
      setQualifications(initialData.qualifications ? [...initialData.qualifications] : []);
    } else {
      setFullName('');
      setUsername('');
      setCpf('');
      setEmail('');
      setPhone('');
      setNotes('');
      setStaffType('RECEPTIONIST');
      setDepartment('Recepção');
      setJobTitle('Recepcionista');
      setContractType('CLT');
      setAdmissionDate(new Date().toISOString().slice(0, 10));
      setQualifications([
        {
          qualification_type: 'TRAINING_LGPD',
          title: 'Treinamento LGPD e Privacidade de Dados de Saúde',
          institution_name: 'OpenClinic Compliance',
          issue_date: new Date().toISOString().slice(0, 10),
          certificate_number: 'LGPD-' + Math.floor(1000 + Math.random() * 9000),
        },
      ]);
    }
    setActiveTab('general');
    setTouched({});
    setFormErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // Single-field validator
  const validateField = (field: string, currentVal?: unknown): string => {
    switch (field) {
      case 'fullName': {
        const val = (currentVal !== undefined ? currentVal : fullName) as string;
        if (!val.trim()) return t('VALIDATION_ERROR_REQUIRED');
        if (val.trim().length < 2) return t('VALIDATION_ERROR_NAME_INVALID');
        return '';
      }
      case 'username': {
        const val = (currentVal !== undefined ? currentVal : username) as string;
        if (!val.trim()) return t('VALIDATION_ERROR_REQUIRED');
        if (val.trim().length < 3 || !/^[a-zA-Z0-9._-]+$/.test(val.trim())) {
          return t('VALIDATION_ERROR_USERNAME_INVALID');
        }
        const collisions = checkIdentityUniqueness({
          username: val.trim(),
          excludeStaffId: initialData?.id,
          excludeUserId: initialData?.user_id,
        });
        if (collisions.usernameError) return collisions.usernameError;
        return '';
      }
      case 'cpf': {
        const val = (currentVal !== undefined ? currentVal : cpf) as string;
        if (!val.trim()) return t('VALIDATION_ERROR_REQUIRED');
        if (!Cpf.isValid(val)) return t('VALIDATION_ERROR_CPF_INVALID');
        const collisions = checkIdentityUniqueness({
          cpf: val.trim(),
          excludeStaffId: initialData?.id,
          excludeUserId: initialData?.user_id,
        });
        if (collisions.cpfError) return collisions.cpfError;
        return '';
      }
      case 'email': {
        const val = (currentVal !== undefined ? currentVal : email) as string;
        if (!val.trim()) return t('VALIDATION_ERROR_REQUIRED');
        if (!Email.isValid(val)) return t('VALIDATION_ERROR_EMAIL_INVALID');
        const collisions = checkIdentityUniqueness({
          email: val.trim(),
          excludeStaffId: initialData?.id,
          excludeUserId: initialData?.user_id,
        });
        if (collisions.emailError) return collisions.emailError;
        return '';
      }
      case 'department': {
        const val = (currentVal !== undefined ? currentVal : department) as string;
        if (!val.trim()) return t('VALIDATION_ERROR_REQUIRED');
        return '';
      }
      case 'jobTitle': {
        const val = (currentVal !== undefined ? currentVal : jobTitle) as string;
        if (!val.trim()) return t('VALIDATION_ERROR_REQUIRED');
        return '';
      }
      case 'admissionDate': {
        const val = (currentVal !== undefined ? currentVal : admissionDate) as string;
        if (!val) return t('VALIDATION_ERROR_REQUIRED');
        return '';
      }
      default:
        return '';
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field);
    setFormErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  const handleFieldChange = (field: string, val: string, setter: (v: string) => void) => {
    setter(val);
    if (formErrors[field]) {
      const err = validateField(field, val);
      if (!err) {
        setFormErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    }
  };

  const validateAll = (): boolean => {
    const errs: Record<string, string> = {};

    const fnErr = validateField('fullName');
    if (fnErr) errs.fullName = fnErr;

    const userErr = validateField('username');
    if (userErr) errs.username = userErr;

    const cpfErr = validateField('cpf');
    if (cpfErr) errs.cpf = cpfErr;

    const emailErr = validateField('email');
    if (emailErr) errs.email = emailErr;

    const deptErr = validateField('department');
    if (deptErr) errs.department = deptErr;

    const jobErr = validateField('jobTitle');
    if (jobErr) errs.jobTitle = jobErr;

    const admErr = validateField('admissionDate');
    if (admErr) errs.admissionDate = admErr;

    const collisions = checkIdentityUniqueness({
      username: username.trim(),
      cpf: cpf.trim(),
      email: email.trim(),
      excludeStaffId: initialData?.id,
      excludeUserId: initialData?.user_id,
    });
    if (collisions.usernameError) errs.username = collisions.usernameError;
    if (collisions.cpfError) errs.cpf = collisions.cpfError;
    if (collisions.emailError) errs.email = collisions.emailError;

    setFormErrors(errs);
    setTouched({
      fullName: true,
      username: true,
      cpf: true,
      email: true,
      department: true,
      jobTitle: true,
      admissionDate: true,
    });

    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) {
      if (formErrors.fullName || formErrors.username || formErrors.cpf || formErrors.email) {
        setActiveTab('general');
      } else {
        setActiveTab('employment');
      }
      return;
    }

    const payload: CreateStaffPayload = {
      full_name: fullName.trim(),
      username: username.trim().toLowerCase(),
      cpf: Cpf.clean(cpf) || undefined,
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      staff_type: staffType,
      department: department.trim(),
      job_title: jobTitle.trim(),
      contract_type: contractType,
      admission_date: admissionDate,
      notes: notes.trim() || undefined,
      login_password: !initialData ? 'Temp@1234' : undefined,
      qualifications,
    };

    try {
      await onSave(payload);
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message;
        if (msg.includes('username') || msg.includes('Nome de usuário')) {
          setFormErrors((prev) => ({ ...prev, username: msg }));
          setActiveTab('general');
        } else if (msg.includes('cpf') || msg.includes('CPF')) {
          setFormErrors((prev) => ({ ...prev, cpf: msg }));
          setActiveTab('general');
        } else if (msg.includes('email') || msg.includes('E-mail') || msg.includes('e-mail')) {
          setFormErrors((prev) => ({ ...prev, email: msg }));
          setActiveTab('general');
        }
      }
    }
  };

  const addQualification = () => {
    setQualifications((prev) => [
      ...prev,
      {
        qualification_type: 'TRAINING_LGPD',
        title: '',
        institution_name: '',
        issue_date: new Date().toISOString().slice(0, 10),
        certificate_number: '',
      },
    ]);
  };

  const removeQualification = (idx: number) => {
    setQualifications((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQualification = (idx: number, patch: Partial<StaffQualificationItem>) => {
    setQualifications((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 38,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: '0.85rem',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'general', label: t('TAB_STAFF_GENERAL'), icon: '👤' },
    { key: 'employment', label: t('TAB_STAFF_EMPLOYMENT'), icon: '💼' },
    { key: 'qualifications', label: t('TAB_STAFF_QUALIFICATIONS'), icon: '📜' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
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
          borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: 1040,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(2, 132, 199, 0.25)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
              }}
            >
              👥
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                {initialData ? t('STAFF_MODAL_EDIT_TITLE') : t('STAFF_MODAL_CREATE_TITLE')}
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                {fullName || t('STAFF_MODAL_SUBTITLE')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation - Full width, equal distribution, no horizontal scroll */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            flexWrap: 'nowrap',
          }}
        >
          {tabs.map((tab) => {
            const isCurrent = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 8,
                  border: isCurrent ? '1px solid #0284c7' : '1px solid transparent',
                  background: isCurrent ? '#0284c7' : 'transparent',
                  color: isCurrent ? '#ffffff' : '#64748b',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
          {/* Tab 1: Identification */}
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: 14 }}>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_FULL_NAME')} required />
                  <input
                    type="text"
                    value={fullName}
                    onBlur={() => handleBlur('fullName')}
                    onChange={(e) => handleFieldChange('fullName', e.target.value, setFullName)}
                    placeholder={t('STAFF_FIELD_NAME_PLACEHOLDER')}
                    style={{ ...inputStyle, borderColor: formErrors.fullName ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.fullName && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.fullName}</span>}
                </div>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_CPF')} required tooltip={t('FIELD_REGISTRY_CPF_TOOLTIP')} />
                  <input
                    type="text"
                    value={cpf}
                    maxLength={14}
                    onBlur={() => handleBlur('cpf')}
                    onChange={(e) => handleFieldChange('cpf', Cpf.format(e.target.value), setCpf)}
                    placeholder="000.000.000-00"
                    style={{
                      ...inputStyle,
                      fontFamily: 'monospace',
                      borderColor: formErrors.cpf ? '#ef4444' : '#cbd5e1',
                    }}
                  />
                  {formErrors.cpf && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.cpf}</span>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr', gap: 14 }}>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_USERNAME')} required tooltip={t('FIELD_USERNAME_TOOLTIP')} />
                  <input
                    type="text"
                    value={username}
                    onBlur={() => handleBlur('username')}
                    onChange={(e) => handleFieldChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''), setUsername)}
                    placeholder="ex: carlos.silva"
                    style={{ ...inputStyle, borderColor: formErrors.username ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.username && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.username}</span>}
                </div>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_EMAIL')} required tooltip={t('FIELD_STAFF_EMAIL_TOOLTIP')} />
                  <input
                    type="email"
                    value={email}
                    onBlur={() => handleBlur('email')}
                    onChange={(e) => handleFieldChange('email', e.target.value, setEmail)}
                    placeholder="colaborador@openclinic.local"
                    style={{ ...inputStyle, borderColor: formErrors.email ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.email && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.email}</span>}
                </div>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_PHONE')} />
                  <input
                    type="text"
                    value={phone}
                    maxLength={15}
                    onChange={(e) => setPhone(Phone.format(e.target.value))}
                    placeholder="(00) 00000-0000"
                    style={{ ...inputStyle, fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div>
                <FieldLabelWithTooltip label={t('FIELD_NOTES')} />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('FIELD_NOTES_STAFF_PLACEHOLDER')}
                  rows={3}
                  style={{ ...inputStyle, height: 'auto', padding: '8px 12px' }}
                />
              </div>

              {initialData && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: '#e0f2fe',
                      border: '1px solid #bae6fd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}
                  >
                    🔐
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                      {t('FIELD_LINKED_ACCOUNT_TITLE')}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>
                      {t('FIELD_LINKED_ACCOUNT_DESC', {
                        cpf: Cpf.format(cpf || initialData.cpf || ''),
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Employment & Role */}
          {activeTab === 'employment' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_STAFF_TYPE')} required />
                  <select
                    value={staffType}
                    onChange={(e) => setStaffType(e.target.value)}
                    style={inputStyle}
                  >
                    {STAFF_TYPES.map((st) => (
                      <option key={st.value} value={st.value}>
                        {t(st.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_CONTRACT_TYPE')} required />
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value)}
                    style={inputStyle}
                  >
                    {CONTRACT_TYPES.map((ct) => (
                      <option key={ct.value} value={ct.value}>
                        {t(ct.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 150px', gap: 14 }}>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_DEPARTMENT')} required />
                  <input
                    type="text"
                    value={department}
                    onBlur={() => handleBlur('department')}
                    onChange={(e) => handleFieldChange('department', e.target.value, setDepartment)}
                    placeholder={t('STAFF_FIELD_DEPT_PLACEHOLDER')}
                    style={{ ...inputStyle, borderColor: formErrors.department ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.department && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.department}</span>}
                </div>
                <div>
                  <FieldLabelWithTooltip label={t('STAFF_COL_ROLE')} required />
                  <input
                    type="text"
                    value={jobTitle}
                    onBlur={() => handleBlur('jobTitle')}
                    onChange={(e) => handleFieldChange('jobTitle', e.target.value, setJobTitle)}
                    placeholder={t('STAFF_FIELD_ROLE_PLACEHOLDER')}
                    style={{ ...inputStyle, borderColor: formErrors.jobTitle ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.jobTitle && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.jobTitle}</span>}
                </div>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_ADMISSION_DATE')} required />
                  <input
                    type="date"
                    value={admissionDate}
                    onBlur={() => handleBlur('admissionDate')}
                    onChange={(e) => handleFieldChange('admissionDate', e.target.value, setAdmissionDate)}
                    style={{ ...inputStyle, borderColor: formErrors.admissionDate ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.admissionDate && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.admissionDate}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Qualifications & Trainings */}
          {activeTab === 'qualifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.90rem', color: '#0f172a' }}>{t('TAB_STAFF_QUALIFICATIONS')}</h4>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('STAFF_QUALIFICATIONS_HINT')}</div>
                </div>
                <button
                  type="button"
                  onClick={addQualification}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 6,
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ➕ {t('REGISTRIES_BTN_ADD_CERTIFICATION')}
                </button>
              </div>

              {qualifications.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', color: '#64748b' }}>
                  {t('STAFF_NO_QUALIFICATIONS')}
                </div>
              ) : (
                qualifications.map((qual, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: 14,
                      display: 'grid',
                      gridTemplateColumns: '150px 2fr 1.5fr 120px 40px',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_TRAINING_TYPE')}</label>
                      <select
                        value={qual.qualification_type}
                        onChange={(e) => updateQualification(idx, { qualification_type: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="TRAINING_LGPD">{t('FIELD_STAFF_QUAL_TRAINING_LGPD')}</option>
                        <option value="TISS_BILLING">{t('FIELD_STAFF_QUAL_TISS_BILLING')}</option>
                        <option value="BASIC_LIFE_SUPPORT">{t('FIELD_STAFF_QUAL_BASIC_LIFE_SUPPORT')}</option>
                        <option value="CUSTOMER_SERVICE">{t('FIELD_STAFF_QUAL_CUSTOMER_SERVICE')}</option>
                        <option value="SOFTWARE_TRAINING">{t('FIELD_STAFF_QUAL_SOFTWARE_TRAINING')}</option>
                        <option value="OTHER">{t('FIELD_STAFF_QUAL_OTHER')}</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_STAFF_QUAL_COURSE_NAME')}</label>
                      <input
                        type="text"
                        value={qual.title}
                        onChange={(e) => updateQualification(idx, { title: e.target.value })}
                        placeholder={t('STAFF_FIELD_COURSE_PLACEHOLDER')}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_STAFF_QUAL_ISSUING_INSTITUTION')}</label>
                      <input
                        type="text"
                        value={qual.institution_name}
                        onChange={(e) => updateQualification(idx, { institution_name: e.target.value })}
                        placeholder={t('STAFF_FIELD_INSTITUTION_PLACEHOLDER')}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_STAFF_QUAL_ISSUE_DATE')}</label>
                      <input
                        type="date"
                        value={qual.issue_date || ''}
                        onChange={(e) => updateQualification(idx, { issue_date: e.target.value })}
                        style={inputStyle}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeQualification(idx)}
                      style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: 6,
                        height: 36,
                        marginTop: 14,
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                      title={t('REGISTRIES_BTN_REMOVE')}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Modal Footer with subtle hover tooltip on Save */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 38,
                padding: '0 18px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('GLOBAL_BTN_CANCEL')}
            </button>

            <div style={{ position: 'relative' }}>
              {showSaveHint && !initialData && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: 0,
                    marginBottom: 8,
                    width: 290,
                    padding: '8px 12px',
                    background: '#0f172a',
                    color: '#f8fafc',
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    lineHeight: 1.35,
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.25)',
                    pointerEvents: 'none',
                    zIndex: 50,
                    textAlign: 'left',
                  }}
                >
                  💡 {t('REGISTRY_SAVE_ACCOUNT_TOOLTIP')}
                </div>
              )}
              <button
                type="submit"
                disabled={isSaving}
                onMouseEnter={() => setShowSaveHint(true)}
                onMouseLeave={() => setShowSaveHint(false)}
                style={{
                  height: 38,
                  padding: '0 22px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0284c7',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {isSaving ? t('GLOBAL_LABEL_SAVING') : t('STAFF_SAVE_BTN')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
