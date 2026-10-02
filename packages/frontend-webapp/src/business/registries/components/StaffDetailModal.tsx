import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../../i18n/index.js';
import {
  type StaffItem,
  type CreateStaffPayload,
  type StaffQualificationItem,
  checkIdentityUniqueness,
  listOrganizationUnits,
} from '../../../services/api.js';
import type { OrganizationUnitData } from '../organizations/types.js';
import { suggestUsername } from '../utils/suggest-username.js';
import { FieldLabelWithTooltip } from '../../../arch/components/FormControls.js';
import {
  BirthDate,
  ContractType,
  Cpf,
  Email,
  Phone,
  StaffQualificationType,
  StaffType,
  Username,
} from '@openclinic/core/shared';
import type { TranslationKey } from '../../../i18n/types.js';

export interface StaffDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CreateStaffPayload) => Promise<void>;
  initialData?: StaffItem | null;
  /** Current staff list, used for client-side CPF/e-mail collision detection. */
  existingStaff?: StaffItem[];
  isSaving: boolean;
}

type TabKey = 'general' | 'employment' | 'qualifications';

interface SelectOption<T extends string> {
  value: T;
  labelKey: TranslationKey;
}

/** Qualification row plus a stable client-side key so React can track rows across removal. */
type QualificationRow = StaffQualificationItem & { rowKey: string };

let qualificationRowSeq = 0;
const nextRowKey = (): string => {
  qualificationRowSeq += 1;
  return `qual-row-${qualificationRowSeq}`;
};

const STAFF_TYPE_OPTIONS: readonly SelectOption<StaffType>[] = [
  { value: StaffType.ADMINISTRATIVE, labelKey: 'FIELD_STAFF_TYPE_ADMINISTRATIVE' },
  { value: StaffType.RECEPTIONIST, labelKey: 'FIELD_STAFF_TYPE_RECEPTIONIST' },
  { value: StaffType.ASSISTANT, labelKey: 'FIELD_STAFF_TYPE_ASSISTANT' },
  { value: StaffType.MANAGER, labelKey: 'FIELD_STAFF_TYPE_MANAGER' },
  { value: StaffType.FINANCIAL, labelKey: 'FIELD_STAFF_TYPE_FINANCIAL' },
  { value: StaffType.IT_SUPPORT, labelKey: 'FIELD_STAFF_TYPE_IT_SUPPORT' },
  { value: StaffType.OTHER, labelKey: 'FIELD_STAFF_TYPE_OTHER' },
];

const CONTRACT_TYPE_OPTIONS: readonly SelectOption<ContractType>[] = [
  { value: ContractType.CLT, labelKey: 'FIELD_CONTRACT_CLT' },
  { value: ContractType.PJ, labelKey: 'FIELD_CONTRACT_PJ' },
  { value: ContractType.INTERN, labelKey: 'FIELD_CONTRACT_INTERN' },
  { value: ContractType.TEMPORARY, labelKey: 'FIELD_CONTRACT_TEMPORARY' },
  { value: ContractType.VOLUNTEER, labelKey: 'FIELD_CONTRACT_VOLUNTEER' },
  { value: ContractType.OTHER, labelKey: 'FIELD_CONTRACT_OTHER' },
];

const QUALIFICATION_TYPE_OPTIONS: readonly SelectOption<StaffQualificationType>[] = [
  { value: StaffQualificationType.CERTIFICATE, labelKey: 'FIELD_STAFF_QUAL_CERTIFICATE' },
  { value: StaffQualificationType.TRAINING, labelKey: 'FIELD_STAFF_QUAL_TRAINING' },
  { value: StaffQualificationType.DIPLOMA, labelKey: 'FIELD_STAFF_QUAL_DIPLOMA' },
  { value: StaffQualificationType.LICENSE, labelKey: 'FIELD_STAFF_QUAL_LICENSE' },
  { value: StaffQualificationType.OTHER, labelKey: 'FIELD_STAFF_QUAL_OTHER' },
];

/**
 * Today's date as YYYY-MM-DD in the browser's local timezone.
 * `new Date().toISOString()` would return the UTC day, which is already
 * tomorrow for BRT (UTC-3) users after 21:00.
 */
function todayLocalIsoDate(): string {
  const now = new Date();
  const localMs = now.getTime() - now.getTimezoneOffset() * 60_000;
  return new Date(localMs).toISOString().slice(0, 10);
}

export const StaffDetailModal: React.FC<StaffDetailModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingStaff,
  isSaving,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const formRef = useRef<HTMLDivElement>(null);

  // Scroll form body to top whenever the active tab changes — prevents content from appearing mid-page
  useEffect(() => {
    if (formRef.current) formRef.current.scrollTop = 0;
  }, [activeTab]);

  // Tab 1: Identification
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  /** Set once the operator types in the login field, which stops the automatic suggestion. */
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Tab 2: Employment & Role
  const [staffType, setStaffType] = useState<StaffType>(StaffType.RECEPTIONIST);
  const [department, setDepartment] = useState('');
  const [jobPosition, setJobPosition] = useState('');
  const [contractType, setContractType] = useState<ContractType>(ContractType.CLT);
  const [hireDate, setHireDate] = useState('');
  /** Ids of the units the collaborator works at; the API replaces the whole list on save. */
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [units, setUnits] = useState<OrganizationUnitData[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState(false);

  // Tab 3: Qualifications & Trainings
  const [qualifications, setQualifications] = useState<QualificationRow[]>([]);

  // Validation & onBlur tracking
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.full_name || '');
      setUsername(initialData.username || '');
      setCpf(initialData.cpf ? Cpf.format(initialData.cpf) : '');
      setBirthDate(initialData.birth_date ? initialData.birth_date.slice(0, 10) : '');
      setEmail(initialData.email || '');
      setPhone(initialData.phone ? Phone.format(initialData.phone) : '');
      setStaffType((initialData.staff_type as StaffType) || StaffType.RECEPTIONIST);
      setDepartment(initialData.department || '');
      setJobPosition(initialData.job_position || '');
      setContractType((initialData.contract_type as ContractType) || ContractType.CLT);
      setHireDate(initialData.hire_date ? initialData.hire_date.slice(0, 10) : '');
      setQualifications(
        (initialData.qualifications ?? []).map((q) => ({ ...q, rowKey: nextRowKey() })),
      );
      setSelectedUnitIds(initialData.units ?? []);
    } else {
      setFullName('');
      setUsername('');
      setUsernameEdited(false);
      setCpf('');
      setBirthDate('');
      setEmail('');
      setPhone('');
      setStaffType(StaffType.RECEPTIONIST);
      setDepartment('');
      setJobPosition('');
      setContractType(ContractType.CLT);
      setHireDate(todayLocalIsoDate());
      setQualifications([]);
      setSelectedUnitIds([]);
    }
    setActiveTab('general');
    setTouched({});
    setFormErrors({});
  }, [initialData, isOpen]);

  // The unit catalog is tenant-scoped and rarely changes, so it is fetched once per mount.
  useEffect(() => {
    let isCancelled = false;
    setUnitsLoading(true);
    listOrganizationUnits()
      .then((rows) => {
        if (isCancelled) return;
        setUnits(rows);
        // Only active units are linkable, since the API refuses a link to an inactive one.
        // A stored link to a unit that has since been deactivated is therefore not re-declared.
        const activeIds = new Set(rows.filter((row) => row.isActive).map((row) => row.id));
        setSelectedUnitIds((prev) => prev.filter((id) => activeIds.has(id)));
      })
      .catch(() => {
        if (!isCancelled) setUnits([]);
        setUnitsError(true);
      })
      .finally(() => {
        if (!isCancelled) setUnitsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  // Suggests a login from the name on a new cadastro. Typing in the field stops the
  // suggestion; clearing it hands the choice back to the server, which picks the first
  // free candidate and then numbered fallbacks.
  useEffect(() => {
    if (initialData || usernameEdited) return;
    setUsername(suggestUsername(fullName));
  }, [initialData, usernameEdited, fullName]);

  // Close on Escape — no other modal in this package handles it, but a modal that
  // only closes on a mouse click traps keyboard users.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeUnits = units.filter((unit) => unit.isActive);

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds((prev) => prev.includes(unitId)
      ? prev.filter((id) => id !== unitId)
      : [...prev, unitId]);
  };

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
        // Empty is valid: the server suggests the first free login for the name.
        if (!val.trim()) return '';
        if (!Username.isValid(val)) return t('VALIDATION_ERROR_USERNAME_INVALID');
        const collisions = checkIdentityUniqueness({
          username: val.trim(),
          excludeStaffId: initialData?.id,
          staff: existingStaff,
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
          staff: existingStaff,
        });
        if (collisions.cpfError) return collisions.cpfError;
        return '';
      }
      case 'birthDate': {
        const val = (currentVal !== undefined ? currentVal : birthDate) as string;
        if (!val) return t('VALIDATION_ERROR_REQUIRED');
        if (!BirthDate.isValid(val)) return t('VALIDATION_ERROR_BIRTH_DATE_INVALID');
        return '';
      }
      case 'email': {
        const val = (currentVal !== undefined ? currentVal : email) as string;
        if (!val.trim()) return t('VALIDATION_ERROR_REQUIRED');
        if (!Email.isValid(val)) return t('VALIDATION_ERROR_EMAIL_INVALID');
        const collisions = checkIdentityUniqueness({
          email: val.trim(),
          excludeStaffId: initialData?.id,
          staff: existingStaff,
        });
        if (collisions.emailError) return collisions.emailError;
        return '';
      }
      case 'department': {
        const val = (currentVal !== undefined ? currentVal : department) as string;
        if (!val.trim()) return t('VALIDATION_ERROR_REQUIRED');
        return '';
      }
      case 'jobPosition': {
        const val = (currentVal !== undefined ? currentVal : jobPosition) as string;
        if (!val.trim()) return t('VALIDATION_ERROR_REQUIRED');
        return '';
      }
      case 'hireDate': {
        const val = (currentVal !== undefined ? currentVal : hireDate) as string;
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

  /**
   * Validates every field and returns the collected errors.
   * Returning the map (instead of only a boolean) lets the caller route to the
   * right tab from the fresh errors — reading `formErrors` here would read the
   * previous render's state and always route to the wrong tab.
   */
  const validateAll = (): Record<string, string> => {
    const errs: Record<string, string> = {};

    const fnErr = validateField('fullName');
    if (fnErr) errs.fullName = fnErr;

    const userErr = validateField('username');
    if (userErr) errs.username = userErr;

    const cpfErr = validateField('cpf');
    if (cpfErr) errs.cpf = cpfErr;

    const bdErr = validateField('birthDate');
    if (bdErr) errs.birthDate = bdErr;

    const emailErr = validateField('email');
    if (emailErr) errs.email = emailErr;

    const deptErr = validateField('department');
    if (deptErr) errs.department = deptErr;

    const jobErr = validateField('jobPosition');
    if (jobErr) errs.jobPosition = jobErr;

    const hireErr = validateField('hireDate');
    if (hireErr) errs.hireDate = hireErr;

    setFormErrors(errs);
    setTouched({
      fullName: true,
      username: true,
      cpf: true,
      birthDate: true,
      email: true,
      department: true,
      jobPosition: true,
      hireDate: true,
    });

    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs = validateAll();
    const errorKeys = Object.keys(errs);
    if (errorKeys.length > 0) {
      const generalFields = ['fullName', 'username', 'cpf', 'birthDate', 'email'];
      setActiveTab(errorKeys.some((k) => generalFields.includes(k)) ? 'general' : 'employment');
      return;
    }

    const payload: CreateStaffPayload = {
      full_name: fullName.trim(),
      cpf: Cpf.clean(cpf),
      birth_date: birthDate,
      staff_type: staffType,
      department: department.trim(),
      job_position: jobPosition.trim(),
      contract_type: contractType,
      hire_date: hireDate,
      phone: phone.trim() || undefined,
      email: Email.clean(email),
      username: username.trim().toLowerCase() || undefined,
      units: selectedUnitIds,
      qualifications: qualifications.map((q) => ({
        qualification_type: q.qualification_type,
        title: q.title.trim(),
        issuing_institution: q.issuing_institution?.trim() || undefined,
        year_issued: q.year_issued ?? undefined,
        valid_until: q.valid_until ?? undefined,
      })),
    };

    // `onSave` (StaffView.handleSave) owns error presentation for this resource:
    // it reports failures via toast and resolves without rethrowing, so the modal
    // simply stays open on failure.
    await onSave(payload);
  };

  const addQualification = () => {
    setQualifications((prev) => [
      ...prev,
      {
        rowKey: nextRowKey(),
        qualification_type: StaffQualificationType.TRAINING,
        title: '',
        issuing_institution: '',
        year_issued: new Date().getFullYear(),
      },
    ]);
  };

  const removeQualification = (rowKey: string) => {
    setQualifications((prev) => prev.filter((q) => q.rowKey !== rowKey));
  };

  const updateQualification = (rowKey: string, patch: Partial<StaffQualificationItem>) => {
    setQualifications((prev) =>
      prev.map((q) => (q.rowKey === rowKey ? { ...q, ...patch } : q)),
    );
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
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-detail-modal-title"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: 1040,
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* ── Top Header: Title + Close Button ── */}
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
            <h3
              id="staff-detail-modal-title"
              style={{ margin: '0 0 2px', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}
            >
              👥 {initialData ? t('STAFF_MODAL_EDIT_TITLE') : t('STAFF_MODAL_CREATE_TITLE')}
            </h3>
            <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b' }}>
              {fullName || t('STAFF_MODAL_SUBTITLE')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('GLOBAL_BTN_CANCEL')}
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

        {/* ── Tab Navigation ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 22px',
            background: '#ffffff',
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
                  height: 34,
                  padding: '0 14px',
                  borderRadius: 6,
                  border: isCurrent ? '1px solid #0284c7' : '1px solid transparent',
                  background: isCurrent ? '#eff6ff' : 'transparent',
                  color: isCurrent ? '#0284c7' : '#64748b',
                  fontSize: '0.80rem',
                  fontWeight: isCurrent ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.12s ease',
                  borderBottom: isCurrent ? '2px solid #0284c7' : '2px solid transparent',
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          {/* Scrollable tab content */}
          <div
            ref={formRef}
            style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}
          >
          {/* Tab 1: Identification */}
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14, alignItems: 'flex-start' }}>
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
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_BIRTH_DATE')} required />
                  <input
                    type="date"
                    value={birthDate}
                    max={todayLocalIsoDate()}
                    onBlur={() => handleBlur('birthDate')}
                    onChange={(e) => handleFieldChange('birthDate', e.target.value, setBirthDate)}
                    style={{ ...inputStyle, borderColor: formErrors.birthDate ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.birthDate && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.birthDate}</span>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr', gap: 14, alignItems: 'flex-start' }}>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_USERNAME')} tooltip={t('FIELD_USERNAME_TOOLTIP')} />
                  <input
                    type="text"
                    value={username}
                    onBlur={() => handleBlur('username')}
                    onChange={(e) => {
                      // Typing takes ownership of the field, so the name-based suggestion stops.
                      setUsernameEdited(true);
                      handleFieldChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''), setUsername);
                    }}
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
                    inputMode="tel"
                    value={phone}
                    maxLength={15}
                    onChange={(e) => setPhone(Phone.format(e.target.value))}
                    placeholder="(00) 00000-0000"
                    style={{ ...inputStyle, fontFamily: 'monospace' }}
                  />
                </div>
              </div>
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
                    onChange={(e) => setStaffType(e.target.value as StaffType)}
                    style={inputStyle}
                  >
                    {STAFF_TYPE_OPTIONS.map((st) => (
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
                    onChange={(e) => setContractType(e.target.value as ContractType)}
                    style={inputStyle}
                  >
                    {CONTRACT_TYPE_OPTIONS.map((ct) => (
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
                  <FieldLabelWithTooltip label={t('FIELD_JOB_TITLE')} required />
                  <input
                    type="text"
                    value={jobPosition}
                    onBlur={() => handleBlur('jobPosition')}
                    onChange={(e) => handleFieldChange('jobPosition', e.target.value, setJobPosition)}
                    placeholder={t('STAFF_FIELD_ROLE_PLACEHOLDER')}
                    style={{ ...inputStyle, borderColor: formErrors.jobPosition ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.jobPosition && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.jobPosition}</span>}
                </div>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_ADMISSION_DATE')} required />
                  <input
                    type="date"
                    value={hireDate}
                    onBlur={() => handleBlur('hireDate')}
                    onChange={(e) => handleFieldChange('hireDate', e.target.value, setHireDate)}
                    style={{ ...inputStyle, borderColor: formErrors.hireDate ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.hireDate && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.hireDate}</span>}
                </div>
              </div>

              <div>
                <FieldLabelWithTooltip label={t('FIELD_STAFF_UNITS')} tooltip={t('FIELD_STAFF_UNITS_TOOLTIP')} />
                {unitsError ? (
                  <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: '0.78rem' }}>
                    {t('STAFF_UNITS_LOAD_ERROR')}
                  </div>
                ) : unitsLoading ? (
                  <div style={{ padding: 12, color: '#64748b', fontSize: '0.78rem' }}>{t('GLOBAL_LABEL_LOADING')}</div>
                ) : activeUnits.length === 0 ? (
                  <div style={{ padding: 12, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, color: '#64748b', fontSize: '0.78rem' }}>
                    {t('STAFF_UNITS_EMPTY')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {activeUnits.map((unit) => {
                        const isSelected = selectedUnitIds.includes(unit.id);
                        return (
                          <button
                            key={unit.id}
                            type="button"
                            onClick={() => toggleUnit(unit.id)}
                            aria-pressed={isSelected}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '7px 12px',
                              borderRadius: 999,
                              border: `1px solid ${isSelected ? '#0284c7' : '#cbd5e1'}`,
                              background: isSelected ? '#e0f2fe' : '#ffffff',
                              color: isSelected ? '#075985' : '#475569',
                              fontSize: '0.78rem',
                              fontWeight: isSelected ? 600 : 500,
                              cursor: 'pointer',
                            }}
                          >
                            <span aria-hidden="true">{isSelected ? '✓' : '+'}</span>
                            {unit.name}
                            {unit.cnesCode ? ` · ${unit.cnesCode}` : ''}
                          </button>
                        );
                      })}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {t('STAFF_UNITS_SELECTED', { count: selectedUnitIds.length })}
                    </span>
                  </div>
                )}
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
                qualifications.map((qual) => (
                  <div
                    key={qual.rowKey}
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
                        onChange={(e) => updateQualification(qual.rowKey, { qualification_type: e.target.value })}
                        style={inputStyle}
                      >
                        {QUALIFICATION_TYPE_OPTIONS.map((qt) => (
                          <option key={qt.value} value={qt.value}>
                            {t(qt.labelKey)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_STAFF_QUAL_COURSE_NAME')}</label>
                      <input
                        type="text"
                        value={qual.title}
                        onChange={(e) => updateQualification(qual.rowKey, { title: e.target.value })}
                        placeholder={t('STAFF_FIELD_COURSE_PLACEHOLDER')}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_STAFF_QUAL_ISSUING_INSTITUTION')}</label>
                      <input
                        type="text"
                        value={qual.issuing_institution || ''}
                        onChange={(e) => updateQualification(qual.rowKey, { issuing_institution: e.target.value })}
                        placeholder={t('STAFF_FIELD_INSTITUTION_PLACEHOLDER')}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_YEAR')}</label>
                      <input
                        type="number"
                        value={qual.year_issued ?? ''}
                        onChange={(e) => updateQualification(qual.rowKey, { year_issued: Number(e.target.value) || null })}
                        placeholder="2012"
                        style={inputStyle}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeQualification(qual.rowKey)}
                      aria-label={t('REGISTRIES_BTN_REMOVE')}
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

          </div>

          {/* Modal Footer — outside scroll, always visible */}
          <div
            style={{
              flexShrink: 0,
              padding: '14px 24px',
              borderTop: '1px solid #e2e8f0',
              background: '#ffffff',
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

            <button
              type="submit"
              disabled={isSaving}
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
        </form>
      </div>
    </div>
  );
};
