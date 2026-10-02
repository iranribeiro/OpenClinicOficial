import React, { useState, useEffect, useRef } from 'react';
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
  listOrganizationUnits,
  checkIdentityUniqueness,
} from '../../../services/api.js';
import type { OrganizationUnitData } from '../organizations/types.js';
import { PractitionerUnitsScheduleTab } from './PractitionerUnitsScheduleTab.js';
import { suggestUsername } from '../utils/suggest-username.js';
import { ToggleSwitch, FieldLabelWithTooltip } from '../../../arch/components/FormControls.js';
import { Cpf, Cns, Email, CouncilRegistration, Rqe, Phone, Username } from '@openclinic/core/shared';

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
// Overlay padding — must stay in sync with the overlay style below.
const OVERLAY_PADDING = 16;
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
  const formRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [topOffset, setTopOffset] = useState<number | null>(null);

  // Reset scroll to top whenever tab changes — prevents content from appearing mid-page
  useEffect(() => {
    if (formRef.current) formRef.current.scrollTop = 0;
  }, [activeTab]);

  // The modal opens with the identification tab centered; its measured top offset is
  // then reused so every other tab — shorter or taller — starts at that same position
  // instead of being re-centered on its own height.
  useEffect(() => {
    if (!isOpen || activeTab !== 'general') return;

    const measureCenteredTop = () => {
      const overlay = overlayRef.current;
      const card = cardRef.current;
      if (!overlay || !card) return;
      const available = overlay.clientHeight - OVERLAY_PADDING * 2;
      const height = Math.min(card.offsetHeight, available);
      setTopOffset(Math.max(0, (available - height) / 2));
    };

    measureCenteredTop();
    window.addEventListener('resize', measureCenteredTop);
    return () => window.removeEventListener('resize', measureCenteredTop);
  }, [isOpen, activeTab]);

  // Tab 1: Identification
  const [fullName, setFullName] = useState('');
  const [socialName, setSocialName] = useState('');
  const [username, setUsername] = useState('');
  /** Set once the operator types in the login field, which stops the automatic suggestion. */
  const [usernameEdited, setUsernameEdited] = useState(false);
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

  // Tab 5: Organization units & weekly schedule
  const [availability, setAvailability] = useState<PractitionerAvailabilityItem[]>([]);
  const [units, setUnits] = useState<OrganizationUnitData[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsError, setUnitsError] = useState(false);

  // Validation & onBlur tracking
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showSaveHint, setShowSaveHint] = useState(false);

  useEffect(() => {
    listSpecialties().then(setSpecialtiesCatalog).catch(() => {});
  }, []);

  // Organization units the practitioner can be linked to.
  useEffect(() => {
    let isCancelled = false;
    setUnitsLoading(true);
    listOrganizationUnits()
      .then((result) => {
        if (isCancelled) return;
        setUnits(Array.isArray(result) ? result : []);
        setUnitsError(false);
      })
      .catch(() => {
        if (isCancelled) return;
        setUnits([]);
        setUnitsError(true);
      })
      .finally(() => {
        if (!isCancelled) setUnitsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.full_name || '');
      setSocialName(initialData.social_name || '');
      setUsername(initialData.username || '');
      setCpf(initialData.cpf ? Cpf.format(initialData.cpf) : '');
      setCns(initialData.cns ? Cns.format(initialData.cns) : '');
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
      setUsernameEdited(false);
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
      // The catalog loads asynchronously and a specialty is chosen by its server id, so a
      // new practitioner starts empty rather than seeded with an id the API would reject.
      setSpecialties([]);
      setQualifications([]);
      // A new practitioner starts with no unit linked — linking one is what creates
      // the first shift (and therefore the link itself).
      setAvailability([]);
      setDigitalSignatureType('NONE');
    }
    setActiveTab('general');
    setTouched({});
    setFormErrors({});
  }, [initialData, isOpen]);

  // Suggests a login from the name on a new cadastro. Typing in the field stops the
  // suggestion; clearing it hands the choice back to the server, which picks the first
  // free candidate and then numbered fallbacks.
  useEffect(() => {
    if (initialData || usernameEdited) return;
    setUsername(suggestUsername(fullName));
  }, [initialData, usernameEdited, fullName]);

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
        if (!Username.isValid(val)) return t('VALIDATION_ERROR_USERNAME_INVALID');
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
      // The API resolves the specialty by its server id, so an unset one cannot be saved.
      if (!spec.specialty_id) errs[`spec_${idx}_id`] = t('VALIDATION_ERROR_REQUIRED');
      if (spec.rqe_number && spec.rqe_number.trim() && !Rqe.isValid(spec.rqe_number)) {
        errs[`spec_${idx}_rqe`] = t('VALIDATION_ERROR_RQE_INVALID');
      }
    });

    // The API requires all three on every qualification row, so an incomplete row is
    // reported here rather than as a 400 on submit.
    qualifications.forEach((qual, idx) => {
      if (!qual.degree_name.trim()) errs[`qual_${idx}_degree`] = t('VALIDATION_ERROR_REQUIRED');
      if (!qual.issuing_institution.trim()) errs[`qual_${idx}_institution`] = t('VALIDATION_ERROR_REQUIRED');
      const year = qual.year_issued;
      if (!year || year < 1900 || year > 2200) errs[`qual_${idx}_year`] = t('VALIDATION_ERROR_REQUIRED');
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
      } else if (keys.some((k) => k.startsWith('qual_'))) {
        setActiveTab('qualifications');
      }
      return;
    }

    const payload: CreatePractitionerPayload = {
      full_name: fullName.trim(),
      social_name: socialName.trim() || undefined,
      username: username.trim().toLowerCase() || undefined,
      cpf: Cpf.clean(cpf) || undefined,
      cns: Cns.clean(cns) || undefined,
      birth_date: birthDate,
      gender,
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      photo_url: photoUrl.trim() || undefined,
      is_technical_lead: isTechnicalLead,
      digital_signature_type: digitalSignatureType,
      calendar_color: calendarColor,
      notes: notes.trim() || undefined,
      // The collections carry server-assigned ids and catalog-resolved names that the API
      // rejects (additionalProperties: false), so each is mapped to its wire shape here.
      registrations: registrations.map((reg) => ({
        registration_type: reg.registration_type,
        registration_number: reg.registration_number.trim(),
        registration_state: reg.registration_state,
        is_primary: reg.is_primary,
      })),
      specialties: specialties.map((spec) => ({
        specialty_id: spec.specialty_id,
        is_primary: spec.is_primary,
        rqe_number: spec.rqe_number?.trim() || null,
      })),
      qualifications: qualifications.map((qual) => ({
        qualification_type: qual.qualification_type,
        degree_name: qual.degree_name.trim(),
        issuing_institution: qual.issuing_institution.trim(),
        // validateAll rejects a missing year, so this default only satisfies the type.
        year_issued: qual.year_issued ?? new Date().getFullYear(),
      })),
      availability: availability
        .filter((shift) => Boolean(shift.organization_unit_id))
        .map((shift) => ({
          organization_unit_id: shift.organization_unit_id as string,
          day_of_week: shift.day_of_week,
          start_time: shift.start_time,
          end_time: shift.end_time,
          slot_duration_minutes: shift.slot_duration_minutes,
        })),
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
        specialty_id: specialtiesCatalog[0]?.id ?? '',
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
        issuing_institution: '',
        year_issued: new Date().getFullYear(),
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
    { key: 'availability', label: t('TAB_PRACTITIONER_AVAILABILITY'), icon: '🏥' },
  ];

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        // Centered until the first tab's position is measured; from then on the card
        // is top-anchored at that same offset so switching tabs never re-centers it.
        alignItems: topOffset === null ? 'center' : 'flex-start',
        justifyContent: 'center',
        zIndex: 1000,
        padding: OVERLAY_PADDING,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={cardRef}
        style={{
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: 1100,
          maxHeight: '94vh',
          // Anchors the card to the offset measured on the first tab; height stays
          // content-driven (tab-dependent) and tall tabs scroll internally.
          marginTop: topOffset ?? 0,
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
              🩺 {initialData ? t('PRACTITIONERS_MODAL_EDIT_TITLE') : t('PRACTITIONERS_MODAL_CREATE_TITLE')}
            </h3>
            <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b' }}>
              {fullName || t('PRACTITIONER_MODAL_SUBTITLE')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => setActiveTab('general')}
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
              title="Ir para aba de identificação"
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
                  padding: '0 10px',
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
                  gap: 5,
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
          {/* Scrollable tab content — resets to top on tab change */}
          <div
            ref={formRef}
            style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}
          >
          {/* Tab 1: Identification */}
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr', gap: 14, alignItems: 'flex-start' }}>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_FULL_NAME')} required />
                  <input
                    type="text"
                    value={fullName}
                    onBlur={() => handleBlur('fullName')}
                    onChange={(e) => handleFieldChange('fullName', e.target.value, setFullName)}
                    style={{ ...inputStyle, borderColor: formErrors.fullName ? '#ef4444' : '#cbd5e1' }}
                  />
                  {formErrors.fullName && <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors.fullName}</span>}
                </div>
                <div>
                  <FieldLabelWithTooltip
                    label={t('FIELD_SOCIAL_NAME')}
                    tooltip={t('FIELD_SOCIAL_NAME_TOOLTIP')}
                  />
                  <input
                    type="text"
                    value={socialName}
                    onChange={(e) => setSocialName(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, alignItems: 'flex-start' }}>
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
                    onChange={(e) => handleFieldChange('cns', Cns.format(e.target.value), setCns)}
                    placeholder="000 0000 0000 0000"
                    maxLength={18}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr', gap: 14, alignItems: 'flex-start' }}>
                <div>
                  <FieldLabelWithTooltip label={t('FIELD_USERNAME')} required tooltip={t('FIELD_USERNAME_TOOLTIP')} />
                  <input
                    type="text"
                    value={username}
                    onBlur={() => handleBlur('username')}
                    onChange={(e) => {
                      // Typing takes ownership of the field, so the name-based suggestion stops.
                      setUsernameEdited(true);
                      handleFieldChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''), setUsername);
                    }}
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
                        style={{ ...inputStyle, borderColor: formErrors[`spec_${idx}_id`] ? '#ef4444' : '#cbd5e1' }}
                      >
                        {/* A row can only be seeded once the catalog has loaded, so an empty
                            value needs a matching option or the select would show a stale one. */}
                        {!spec.specialty_id && <option value="">{t('FIELD_LABEL_SPECIALTY')}</option>}
                        {specialtiesCatalog.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({cat.cbo_code})
                          </option>
                        ))}
                      </select>
                      {formErrors[`spec_${idx}_id`] && (
                        <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 3, display: 'block' }}>{formErrors[`spec_${idx}_id`]}</span>
                      )}
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
                qualifications.map((qual, idx) => {
                  const rowError = formErrors[`qual_${idx}_degree`] || formErrors[`qual_${idx}_institution`]
                    || formErrors[`qual_${idx}_year`];
                  return (
                  <div
                    key={idx}
                    style={{
                      background: '#f8fafc',
                      border: `1px solid ${rowError ? '#ef4444' : '#e2e8f0'}`,
                      borderRadius: 10,
                      padding: 14,
                      display: 'grid',
                      gridTemplateColumns: '130px 2fr 1.5fr 116px 40px',
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
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_INSTITUTION')}</label>
                      <input
                        type="text"
                        value={qual.issuing_institution}
                        onChange={(e) => updateQualification(idx, { issuing_institution: e.target.value })}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{t('FIELD_LABEL_YEAR')}</label>
                      <input
                        type="number"
                        value={qual.year_issued || ''}
                        onChange={(e) => updateQualification(idx, { year_issued: Number(e.target.value) || null })}
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
                    {rowError && (
                      <span style={{ gridColumn: '1 / -1', color: '#ef4444', fontSize: '0.72rem' }}>{rowError}</span>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 5: Organization Units & Schedule */}
          {activeTab === 'availability' && (
            <PractitionerUnitsScheduleTab
              units={units}
              unitsLoading={unitsLoading}
              unitsError={unitsError}
              availability={availability}
              onChange={setAvailability}
            />
          )}

          </div>

          {/* Modal Footer — outside scroll, always visible at bottom */}
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




