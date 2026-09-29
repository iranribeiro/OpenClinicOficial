import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../i18n/index.js';
import {
  type PractitionerItem,
  type CreatePractitionerPayload,
  type SpecialtyItem,
  type PractitionerRegistrationItem,
  type PractitionerSpecialtyItem,
  type PractitionerQualificationItem,
  type PractitionerAvailabilityItem,
  listSpecialties,
  checkIdentityUniqueness,
} from '../../../services/api.js';
import { ToggleSwitch, FieldLabelWithTooltip } from '../../../arch/components/FormControls.js';
import { Cpf, Cns, Email, CouncilRegistration, Rqe, Phone } from '@openclinic/core/shared';

export interface PractitionerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CreatePractitionerPayload) => Promise<void>;
  initialData?: PractitionerItem | null;
  isSaving: boolean;
}

type TabKey = 'general' | 'registrations' | 'specialties' | 'qualifications' | 'availability';

const COUNCIL_TYPES = ['CRM', 'COREN', 'CRO', 'CRF', 'CRP', 'CREFITO', 'CRN', 'OTHER'] as const;
const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
const DAYS_OF_WEEK = [
  { id: 1, labelKey: 'DAY_MONDAY' },
  { id: 2, labelKey: 'DAY_TUESDAY' },
  { id: 3, labelKey: 'DAY_WEDNESDAY' },
  { id: 4, labelKey: 'DAY_THURSDAY' },
  { id: 5, labelKey: 'DAY_FRIDAY' },
  { id: 6, labelKey: 'DAY_SATURDAY' },
  { id: 0, labelKey: 'DAY_SUNDAY' },
] as const;

export const PractitionerDetailModal: React.FC<PractitionerDetailModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  isSaving,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [specialtiesCatalog, setSpecialtiesCatalog] = useState<SpecialtyItem[]>([]);

  // Tab 1: Identification
  const [fullName, setFullName] = useState('');
  const [socialName, setSocialName] = useState('');
  const [username, setUsername] = useState('');
  const [cpf, setCpf] = useState('');
  const [cns, setCns] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('MALE');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isTechnicalLead, setIsTechnicalLead] = useState(false);
  const [calendarColor, setCalendarColor] = useState('#0284c7');
  const [notes, setNotes] = useState('');

  // Tab 2: Councils & Registrations + ICP-Brasil Signature
  const [registrations, setRegistrations] = useState<PractitionerRegistrationItem[]>([]);
  const [digitalSignatureType, setDigitalSignatureType] = useState('NONE');

  // Tab 3: Specialties & RQE
  const [specialties, setSpecialties] = useState<PractitionerSpecialtyItem[]>([]);

  // Tab 4: Academic Qualifications
  const [qualifications, setQualifications] = useState<PractitionerQualificationItem[]>([]);

  // Tab 5: Clinical Schedule & Availability
  const [availability, setAvailability] = useState<PractitionerAvailabilityItem[]>([]);

  // Validation & onBlur tracking
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showSaveHint, setShowSaveHint] = useState(false);

  useEffect(() => {
    listSpecialties().then(setSpecialtiesCatalog).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.full_name || '');
      setSocialName(initialData.social_name || '');
      setUsername(initialData.username || (initialData.email ? initialData.email.split('@')[0] : ''));
      setCpf(initialData.cpf ? Cpf.format(initialData.cpf) : '');
      setCns(initialData.cns || '');
      setBirthDate(initialData.birth_date ? initialData.birth_date.slice(0, 10) : '');
      setGender(initialData.gender || 'MALE');
      setEmail(initialData.email || '');
      setPhone(initialData.phone ? Phone.format(initialData.phone) : '');
      setPhotoUrl(initialData.photo_url || '');
      setIsTechnicalLead(initialData.is_technical_lead || false);
      setCalendarColor(initialData.calendar_color || '#0284c7');
      setNotes(initialData.notes || '');
      setRegistrations(initialData.registrations ? [...initialData.registrations] : []);
      setSpecialties(initialData.specialties ? [...initialData.specialties] : []);
      setQualifications(initialData.qualifications ? [...initialData.qualifications] : []);
      setAvailability(initialData.availability ? [...initialData.availability] : []);
      setDigitalSignatureType(initialData.digital_signature_type || 'NONE');
    } else {
      setFullName('');
      setSocialName('');
      setUsername('');
      setCpf('');
      setCns('');
      setBirthDate('1985-01-01');
      setGender('MALE');
      setEmail('');
      setPhone('');
      setPhotoUrl('');
      setIsTechnicalLead(false);
      setCalendarColor('#0284c7');
      setNotes('');
      setRegistrations([
        {
          registration_number: '',
          registration_type: 'CRM',
          registration_state: 'SP',
          is_primary: true,
        },
      ]);
      setSpecialties([
        {
          specialty_id: 'spec-001',
          specialty_name: 'Clínica Geral',
          is_primary: true,
          rqe_number: '',
        },
      ]);
      setQualifications([]);
      setAvailability([
        { day_of_week: 1, start_time: '08:00', end_time: '12:00', slot_duration_minutes: 30 },
        { day_of_week: 3, start_time: '14:00', end_time: '18:00', slot_duration_minutes: 30 },
      ]);
      setDigitalSignatureType('NONE');
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
          excludePractitionerId: initialData?.id,
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
          excludePractitionerId: initialData?.id,
          excludeUserId: initialData?.user_id,
        });
        if (collisions.cpfError) return collisions.cpfError;
        return '';
      }
      case 'cns': {
        const val = (currentVal !== undefined ? currentVal : cns) as string;
        if (val.trim() && !Cns.isValid(val)) return t('VALIDATION_ERROR_CNS_INVALID');
        return '';
      }
      case 'email': {
        const val = (currentVal !== undefined ? currentVal : email) as string;
        if (!val.trim()) return t('VALIDATION_ERROR_REQUIRED');
        if (!Email.isValid(val)) return t('VALIDATION_ERROR_EMAIL_INVALID');
        const collisions = checkIdentityUniqueness({
          email: val.trim(),
          excludePractitionerId: initialData?.id,
          excludeUserId: initialData?.user_id,
        });
        if (collisions.emailError) return collisions.emailError;
        return '';
      }
      case 'birthDate': {
        const val = (currentVal !== undefined ? currentVal : birthDate) as string;
        if (!val) return t('VALIDATION_ERROR_REQUIRED');
        return '';
      }
      default: {
        if (field.startsWith('reg_') && field.endsWith('_number')) {
          const idx = parseInt(field.split('_')[1], 10);
          const num = registrations[idx]?.registration_number || '';
          if (!num.trim()) return t('VALIDATION_ERROR_REQUIRED');
          return '';
        }
        if (field.startsWith('spec_') && field.endsWith('_rqe')) {
          const idx = parseInt(field.split('_')[1], 10);
          const rqe = specialties[idx]?.rqe_number || '';
          if (rqe.trim() && !Rqe.isValid(rqe)) return t('VALIDATION_ERROR_RQE_INVALID');
          return '';
        }
        return '';
      }
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

    const cnsErr = validateField('cns');
    if (cnsErr) errs.cns = cnsErr;

    const emailErr = validateField('email');
    if (emailErr) errs.email = emailErr;

    const bdErr = validateField('birthDate');
    if (bdErr) errs.birthDate = bdErr;

    const collisions = checkIdentityUniqueness({
      username: username.trim(),
      cpf: cpf.trim(),
      email: email.trim(),
      excludePractitionerId: initialData?.id,
      excludeUserId: initialData?.user_id,
    });
    if (collisions.usernameError) errs.username = collisions.usernameError;
    if (collisions.cpfError) errs.cpf = collisions.cpfError;
    if (collisions.emailError) errs.email = collisions.emailError;

    if (registrations.length === 0) {
      errs.registrations = t('VALIDATION_ERROR_REGISTRATION_REQUIRED');
    } else {
      registrations.forEach((reg, idx) => {
        if (!reg.registration_number.trim()) {
          errs[`reg_${idx}_number`] = t('VALIDATION_ERROR_COUNCIL_NUMBER_INVALID');
        }
      });
    }

    specialties.forEach((spec, idx) => {
      if (spec.rqe_number && spec.rqe_number.trim() && !Rqe.isValid(spec.rqe_number)) {
        errs[`spec_${idx}_rqe`] = t('VALIDATION_ERROR_RQE_INVALID');
      }
    });

    setFormErrors(errs);
    // Mark all validated fields as touched
    const touchedAll: Record<string, boolean> = {
      fullName: true,
      username: true,
      cpf: true,
      cns: true,
      email: true,
      birthDate: true,
    };
    registrations.forEach((_, idx) => {
      touchedAll[`reg_${idx}_number`] = true;
    });
    setTouched((prev) => ({ ...prev, ...touchedAll }));

    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) {
      const keys = Object.keys(formErrors);
      if (keys.some((k) => ['fullName', 'username', 'cpf', 'cns', 'email', 'birthDate'].includes(k))) {
        setActiveTab('general');
      } else if (keys.some((k) => k.startsWith('reg_') || k === 'registrations')) {
        setActiveTab('registrations');
      } else if (keys.some((k) => k.startsWith('spec_'))) {
        setActiveTab('specialties');
      }
      return;
    }

    const payload: CreatePractitionerPayload = {
      full_name: fullName.trim(),
      social_name: socialName.trim() || undefined,
      username: username.trim().toLowerCase(),
      cpf: Cpf.clean(cpf) || undefined,
      cns: cns.trim() || undefined,
      birth_date: birthDate,
      gender,
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      photo_url: photoUrl.trim() || undefined,
      is_technical_lead: isTechnicalLead,
      digital_signature_type: digitalSignatureType,
      calendar_color: calendarColor,
      notes: notes.trim() || undefined,
      login_password: !initialData ? 'Temp@1234' : undefined,
      registrations,
      specialties,
      qualifications,
      availability,
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

  // Registration helpers
  const addRegistration = () => {
    setRegistrations((prev) => [
      ...prev,
      {
        registration_number: '',
        registration_type: 'CRM',
        registration_state: 'SP',
        is_primary: prev.length === 0,
      },
    ]);
  };

  const removeRegistration = (idx: number) => {
    setRegistrations((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRegistration = (idx: number, patch: Partial<PractitionerRegistrationItem>) => {
    setRegistrations((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
    if (patch.registration_number !== undefined && (touched[`reg_${idx}_number`] || formErrors[`reg_${idx}_number`])) {
      if (patch.registration_number.trim()) {
        setFormErrors((prev) => {
          const next = { ...prev };
          delete next[`reg_${idx}_number`];
          return next;
        });
      }
    }
  };

  // Specialty helpers
  const addSpecialty = () => {
    setSpecialties((prev) => [
      ...prev,
      {
        specialty_id: specialtiesCatalog[0]?.id || 'spec-001',
        is_primary: prev.length === 0,
        rqe_number: '',
      },
    ]);
  };

  const removeSpecialty = (idx: number) => {
    setSpecialties((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSpecialty = (idx: number, patch: Partial<PractitionerSpecialtyItem>) => {
    setSpecialties((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
    if (patch.rqe_number !== undefined && (touched[`spec_${idx}_rqe`] || formErrors[`spec_${idx}_rqe`])) {
      if (!patch.rqe_number || Rqe.isValid(patch.rqe_number)) {
        setFormErrors((prev) => {
          const next = { ...prev };
          delete next[`spec_${idx}_rqe`];
          return next;
        });
      }
    }
  };

  // Qualification helpers
  const addQualification = () => {
    setQualifications((prev) => [
      ...prev,
      {
        qualification_type: 'GRADUATION',
        degree_name: '',
        institution_name: '',
        completion_year: new Date().getFullYear(),
      },
    ]);
  };

  const removeQualification = (idx: number) => {
    setQualifications((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQualification = (idx: number, patch: Partial<PractitionerQualificationItem>) => {
    setQualifications((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  // Availability helpers
  const addAvailabilitySlot = () => {
    setAvailability((prev) => [
      ...prev,
      {
        day_of_week: 1,
        start_time: '08:00',
        end_time: '12:00',
        slot_duration_minutes: 30,
      },
    ]);
  };

  const removeAvailabilitySlot = (idx: number) => {
    setAvailability((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateAvailabilitySlot = (idx: number, patch: Partial<PractitionerAvailabilityItem>) => {
    setAvailability((prev) => {
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
    { key: 'general', label: t('TAB_PRACTITIONER_GENERAL'), icon: '👤' },
    { key: 'registrations', label: t('TAB_PRACTITIONER_REGISTRATIONS'), icon: '📜' },
    { key: 'specialties', label: t('TAB_PRACTITIONER_SPECIALTIES'), icon: '🩺' },
    { key: 'qualifications', label: t('TAB_PRACTITIONER_QUALIFICATIONS'), icon: '🎓' },
    { key: 'availability', label: t('TAB_PRACTITIONER_AVAILABILITY'), icon: '📅' },
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
          maxWidth: 1100,
          maxHeight: '92vh',
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
              🩺
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                {initialData ? t('PRACTITIONERS_MODAL_EDIT_TITLE') : t('PRACTITIONERS_MODAL_CREATE_TITLE')}
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                {fullName || t('PRACTITIONER_MODAL_SUBTITLE')}
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
            gap: 6,
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
                  padding: '0 12px',
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
                  gap: 6,
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
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr', gap: 14 }}>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_FULL_NAME')} required />
                  <input
                    type="text"
                    value={fullName}
                    onBlur={() => handleBlur('fullName')}
                    onChange={(e) => handleFieldChange('fullName', e.target.value, setFullName)}
                    placeholder={t('PRACTITIONER_FIELD_NAME_PLACEHOLDER')}
                    style={{ ...inputStyle, borderColor: formErrors.fullName ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.fullName && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.fullName}</span>}
                </div>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_SOCIAL_NAME')} />
                  <input
                    type="text"
                    value={socialName}
                    onChange={(e) => setSocialName(e.target.value)}
                    placeholder={t('PRACTITIONER_FIELD_SOCIAL_NAME_PLACEHOLDER')}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_CPF')} required tooltip={t('FIELD_REGISTRY_CPF_TOOLTIP')} />
                  <input
                    type="text"
                    value={cpf}
                    onBlur={() => handleBlur('cpf')}
                    onChange={(e) => handleFieldChange('cpf', Cpf.format(e.target.value), setCpf)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    style={{ ...inputStyle, fontFamily: 'monospace', borderColor: formErrors.cpf ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.cpf && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.cpf}</span>}
                </div>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_CNS')} tooltip={t('FIELD_CNS_TOOLTIP')} />
                  <input
                    type="text"
                    value={cns}
                    onBlur={() => handleBlur('cns')}
                    onChange={(e) => handleFieldChange('cns', e.target.value.replace(/\D/g, '').slice(0, 15), setCns)}
                    placeholder="700000000000000"
                    maxLength={15}
                    style={{ ...inputStyle, fontFamily: 'monospace', borderColor: formErrors.cns ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.cns && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.cns}</span>}
                </div>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_BIRTH_DATE')} required />
                  <input
                    type="date"
                    value={birthDate}
                    onBlur={() => handleBlur('birthDate')}
                    onChange={(e) => handleFieldChange('birthDate', e.target.value, setBirthDate)}
                    style={{ ...inputStyle, borderColor: formErrors.birthDate ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.birthDate && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.birthDate}</span>}
                </div>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_GENDER')} />
                  <select value={gender} onChange={(e) => setGender(e.target.value)} style={inputStyle}>
                    <option value="MALE">{t('FIELD_GENDER_MALE')}</option>
                    <option value="FEMALE">{t('FIELD_GENDER_FEMALE')}</option>
                    <option value="OTHER">{t('FIELD_GENDER_OTHER')}</option>
                  </select>
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
                    placeholder="ex: roberto.mendes"
                    style={{ ...inputStyle, borderColor: formErrors.username ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.username && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.username}</span>}
                </div>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_EMAIL')} required tooltip={t('FIELD_REGISTRY_EMAIL_TOOLTIP')} />
                  <input
                    type="email"
                    value={email}
                    onBlur={() => handleBlur('email')}
                    onChange={(e) => handleFieldChange('email', e.target.value, setEmail)}
                    placeholder="medico@openclinic.local"
                    style={{ ...inputStyle, borderColor: formErrors.email ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.email && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.email}</span>}
                </div>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_PHONE')} />
                  <input
                    type="text"
                    inputMode="tel"
                    maxLength={15}
                    value={phone}
                    onChange={(e) => setPhone(Phone.format(e.target.value))}
                    placeholder="(00) 00000-0000"
                    style={{ ...inputStyle, fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 14, alignItems: 'center' }}>
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{t('FIELD_IS_TECHNICAL_LEAD')}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('FIELD_TECHNICAL_LEAD_DESC')}</div>
                    </div>
                    <ToggleSwitch checked={isTechnicalLead} onChange={setIsTechnicalLead} />
                  </div>
                </div>

                <div>
                  <FieldLabelWithTooltip label={t('FIELD_CALENDAR_COLOR')} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={calendarColor}
                      onChange={(e) => setCalendarColor(e.target.value)}
                      style={{ width: 44, height: 38, padding: 0, border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace' }}>{calendarColor}</span>
                  </div>
                </div>
              </div>

              <div>
                <FieldLabelWithTooltip label={t('FIELD_NOTES')} />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('FIELD_NOTES_PRACTITIONER_PLACEHOLDER')}
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

          {/* Tab 2: Councils & Registrations + ICP-Brasil Signature */}
          {activeTab === 'registrations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.90rem', color: '#0f172a' }}>{t('TAB_PRACTITIONER_REGISTRATIONS')}</h4>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('PRACTITIONERS_REGISTRATION_HINT')}</div>
                </div>
                <button
                  type="button"
                  onClick={addRegistration}
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
                  ➕ {t('REGISTRIES_BTN_ADD_REGISTRATION')}
                </button>
              </div>

              {formErrors.registrations && (
                <div style={{ padding: '8px 12px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: '0.78rem' }}>
                  {formErrors.registrations}
                </div>
              )}

              {registrations.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', color: '#64748b' }}>
                  {t('PRACTITIONERS_NO_REGISTRATIONS')}
                </div>
              ) : (
                registrations.map((reg, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: 14,
                      display: 'grid',
                      gridTemplateColumns: '120px 160px 100px 1fr 40px',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_TYPE')}</label>
                      <select
                        value={reg.registration_type}
                        onChange={(e) => updateRegistration(idx, { registration_type: e.target.value })}
                        style={inputStyle}
                      >
                        {COUNCIL_TYPES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_NUMBER')}</label>
                      <input
                        type="text"
                        value={reg.registration_number}
                        onBlur={() => handleBlur(`reg_${idx}_number`)}
                        onChange={(e) => updateRegistration(idx, { registration_number: e.target.value })}
                        placeholder={t('PRACTITIONER_FIELD_REG_NUMBER_PLACEHOLDER')}
                        style={{ ...inputStyle, borderColor: formErrors[`reg_${idx}_number`] ? '#ef4444' : '#cbd5e1' }}
                      />
                      {formErrors[`reg_${idx}_number`] && (
                        <span style={{ color: '#ef4444', fontSize: '0.70rem', marginTop: 2, display: 'block' }}>
                          {formErrors[`reg_${idx}_number`]}
                        </span>
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_UF')}</label>
                      <select
                        value={reg.registration_state}
                        onChange={(e) => updateRegistration(idx, { registration_state: e.target.value })}
                        style={inputStyle}
                      >
                        {BRAZILIAN_STATES.map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                      <input
                        type="checkbox"
                        checked={reg.is_primary}
                        onChange={(e) => updateRegistration(idx, { is_primary: e.target.checked })}
                        id={`reg-primary-${idx}`}
                      />
                      <label htmlFor={`reg-primary-${idx}`} style={{ fontSize: '0.78rem', color: '#334155', cursor: 'pointer' }}>
                        {t('PRACTITIONERS_PRIMARY_REGISTRATION')}
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeRegistration(idx)}
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

              {/* Digital Signature */}
              <div style={{ marginTop: 8, padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                <FieldLabelWithTooltip
                  label={t('FIELD_DIGITAL_SIGNATURE')}
                  tooltip={t('FIELD_DIGITAL_SIGNATURE_TOOLTIP')}
                />
                <select
                  value={digitalSignatureType}
                  onChange={(e) => setDigitalSignatureType(e.target.value)}
                  style={{ ...inputStyle, marginTop: 4 }}
                >
                  <option value="NONE">{t('FIELD_DIGITAL_SIG_NONE')}</option>
                  <option value="ICP_BRASIL_A1">{t('FIELD_DIGITAL_SIG_ICP_A1')}</option>
                  <option value="ICP_BRASIL_A3">{t('FIELD_DIGITAL_SIG_ICP_A3')}</option>
                  <option value="ICP_BRASIL_CLOUD">{t('FIELD_DIGITAL_SIG_ICP_CLOUD')}</option>
                </select>
              </div>
            </div>
          )}

          {/* Tab 3: Specialties & RQE */}
          {activeTab === 'specialties' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.90rem', color: '#0f172a' }}>{t('TAB_PRACTITIONER_SPECIALTIES')}</h4>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('PRACTITIONERS_SPECIALTIES_HINT')}</div>
                </div>
                <button
                  type="button"
                  onClick={addSpecialty}
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
                  ➕ {t('REGISTRIES_BTN_ADD_SPECIALTY')}
                </button>
              </div>

              {specialties.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', color: '#64748b' }}>
                  {t('PRACTITIONERS_NO_SPECIALTIES')}
                </div>
              ) : (
                specialties.map((spec, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: 14,
                      display: 'grid',
                      gridTemplateColumns: '2fr 1.4fr 1fr 40px',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_SPECIALTY')}</label>
                      <select
                        value={spec.specialty_id}
                        onChange={(e) => {
                          const found = specialtiesCatalog.find((c) => c.id === e.target.value);
                          updateSpecialty(idx, {
                            specialty_id: e.target.value,
                            specialty_name: found?.name,
                          });
                        }}
                        style={inputStyle}
                      >
                        {specialtiesCatalog.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({cat.cbo_code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_RQE')}</label>
                      <input
                        type="text"
                        value={spec.rqe_number || ''}
                        onBlur={() => handleBlur(`spec_${idx}_rqe`)}
                        onChange={(e) => updateSpecialty(idx, { rqe_number: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                        placeholder={t('PRACTITIONER_FIELD_RQE_PLACEHOLDER')}
                        style={{ ...inputStyle, borderColor: formErrors[`spec_${idx}_rqe`] ? '#ef4444' : '#cbd5e1' }}
                      />
                      {formErrors[`spec_${idx}_rqe`] && (
                        <span style={{ color: '#ef4444', fontSize: '0.70rem', marginTop: 2, display: 'block' }}>
                          {formErrors[`spec_${idx}_rqe`]}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                      <input
                        type="checkbox"
                        checked={spec.is_primary}
                        onChange={(e) => updateSpecialty(idx, { is_primary: e.target.checked })}
                        id={`spec-primary-${idx}`}
                      />
                      <label htmlFor={`spec-primary-${idx}`} style={{ fontSize: '0.78rem', color: '#334155', cursor: 'pointer' }}>
                        {t('PRACTITIONERS_PRIMARY_SPECIALTY')}
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeSpecialty(idx)}
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

          {/* Tab 4: Academic Qualifications */}
          {activeTab === 'qualifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.90rem', color: '#0f172a' }}>{t('TAB_PRACTITIONER_QUALIFICATIONS')}</h4>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('PRACTITIONERS_QUALIFICATIONS_HINT')}</div>
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
                  ➕ {t('REGISTRIES_BTN_ADD_QUALIFICATION')}
                </button>
              </div>

              {qualifications.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', color: '#64748b' }}>
                  {t('PRACTITIONERS_NO_QUALIFICATIONS')}
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
                      gridTemplateColumns: '130px 2fr 1.5fr 90px 40px',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_TYPE')}</label>
                      <select
                        value={qual.qualification_type}
                        onChange={(e) => updateQualification(idx, { qualification_type: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="GRADUATION">{t('FIELD_QUALIFICATION_TYPE_GRADUATION')}</option>
                        <option value="RESIDENCY">{t('FIELD_QUALIFICATION_TYPE_RESIDENCY')}</option>
                        <option value="SPECIALIZATION">{t('FIELD_QUALIFICATION_TYPE_SPECIALIZATION')}</option>
                        <option value="MASTER">{t('FIELD_QUALIFICATION_TYPE_MASTER')}</option>
                        <option value="DOCTORATE">{t('FIELD_QUALIFICATION_TYPE_DOCTORATE')}</option>
                        <option value="OTHER">{t('FIELD_QUALIFICATION_TYPE_OTHER')}</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_COURSE_TITLE')}</label>
                      <input
                        type="text"
                        value={qual.degree_name}
                        onChange={(e) => updateQualification(idx, { degree_name: e.target.value })}
                        placeholder={t('PRACTITIONER_FIELD_DEGREE_PLACEHOLDER')}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_INSTITUTION')}</label>
                      <input
                        type="text"
                        value={qual.institution_name}
                        onChange={(e) => updateQualification(idx, { institution_name: e.target.value })}
                        placeholder={t('PRACTITIONER_FIELD_INSTITUTION_PLACEHOLDER')}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_YEAR')}</label>
                      <input
                        type="number"
                        value={qual.completion_year || ''}
                        onChange={(e) => updateQualification(idx, { completion_year: Number(e.target.value) || null })}
                        placeholder="2012"
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

          {/* Tab 5: Clinical Schedule & Availability */}
          {activeTab === 'availability' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.90rem', color: '#0f172a' }}>{t('TAB_PRACTITIONER_AVAILABILITY')}</h4>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('PRACTITIONERS_AVAILABILITY_HINT')}</div>
                </div>
                <button
                  type="button"
                  onClick={addAvailabilitySlot}
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
                  ➕ {t('REGISTRIES_BTN_ADD_SHIFT')}
                </button>
              </div>

              {availability.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', color: '#64748b' }}>
                  {t('PRACTITIONERS_NO_AVAILABILITY')}
                </div>
              ) : (
                availability.map((avail, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: 14,
                      display: 'grid',
                      gridTemplateColumns: '180px 110px 110px 140px 40px',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_DAY_OF_WEEK')}</label>
                      <select
                        value={avail.day_of_week}
                        onChange={(e) => updateAvailabilitySlot(idx, { day_of_week: Number(e.target.value) })}
                        style={inputStyle}
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <option key={d.id} value={d.id}>{t(d.labelKey)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_START_TIME')}</label>
                      <input
                        type="time"
                        value={avail.start_time}
                        onChange={(e) => updateAvailabilitySlot(idx, { start_time: e.target.value })}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_END_TIME')}</label>
                      <input
                        type="time"
                        value={avail.end_time}
                        onChange={(e) => updateAvailabilitySlot(idx, { end_time: e.target.value })}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_SLOT_DURATION')}</label>
                      <select
                        value={avail.slot_duration_minutes}
                        onChange={(e) => updateAvailabilitySlot(idx, { slot_duration_minutes: Number(e.target.value) })}
                        style={inputStyle}
                      >
                        <option value={15}>{t('FIELD_SLOT_DURATION_MINUTES', { minutes: 15 })}</option>
                        <option value={20}>{t('FIELD_SLOT_DURATION_MINUTES', { minutes: 20 })}</option>
                        <option value={30}>{t('FIELD_SLOT_DURATION_MINUTES', { minutes: 30 })}</option>
                        <option value={45}>{t('FIELD_SLOT_DURATION_MINUTES', { minutes: 45 })}</option>
                        <option value={60}>{t('FIELD_SLOT_DURATION_MINUTES', { minutes: 60 })}</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeAvailabilitySlot(idx)}
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
                {isSaving ? t('GLOBAL_LABEL_SAVING') : t('PRACTITIONERS_SAVE_BTN')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
