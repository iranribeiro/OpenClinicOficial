import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/index.js';
import {
  listPractitioners,
  createPractitioner,
  updatePractitioner,
  deletePractitioner,
  listSpecialties,
  type PractitionerItem,
  type CreatePractitionerPayload,
  type SpecialtyItem,
} from '../../services/api.js';
import { PractitionerDetailModal } from './components/PractitionerDetailModal.js';
import { useToast } from '../../context/ToastContext.js';

export const PractitionersView: React.FC = () => {
  const { t } = useI18n();

  const [practitioners, setPractitioners] = useState<PractitionerItem[]>([]);
  const [specialtiesCatalog, setSpecialtiesCatalog] = useState<SpecialtyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPractitioner, setEditingPractitioner] = useState<PractitionerItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Deletion Confirmation
  const [deletingTarget, setDeletingTarget] = useState<PractitionerItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [practs, specs] = await Promise.all([listPractitioners(), listSpecialties()]);
      setPractitioners(Array.isArray(practs) ? practs : []);
      setSpecialtiesCatalog(Array.isArray(specs) ? specs : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('PRACTITIONERS_ERROR_LOAD'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingPractitioner(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: PractitionerItem) => {
    setEditingPractitioner(p);
    setIsModalOpen(true);
  };

  const handleSave = async (payload: CreatePractitionerPayload) => {
    setIsSaving(true);
    try {
      if (editingPractitioner) {
        await updatePractitioner(editingPractitioner.id, payload);
        toast.success(t('PRACTITIONER_MSG_UPDATE_SUCCESS'));
      } else {
        await createPractitioner(payload);
        toast.success(t('PRACTITIONER_CREATED_SUCCESS'));
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('PRACTITIONERS_ERROR_SAVE'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTarget) return;
    setIsDeleting(true);
    try {
      await deletePractitioner(deletingTarget.id);
      toast.success(t('PRACTITIONER_MSG_DELETE_SUCCESS'));
      setDeletingTarget(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('PRACTITIONERS_ERROR_DELETE'));
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredPractitioners = useMemo(() => {
    return practitioners.filter((p) => {
      if (statusFilter === 'ACTIVE' && !p.is_active) return false;
      if (statusFilter === 'INACTIVE' && p.is_active) return false;

      if (specialtyFilter !== 'ALL') {
        const hasSpec = p.specialties?.some((s) => s.specialty_id === specialtyFilter);
        if (!hasSpec) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = p.full_name?.toLowerCase().includes(q) || p.social_name?.toLowerCase().includes(q);
        const matchesCpf = p.cpf?.includes(q);
        const matchesEmail = p.email?.toLowerCase().includes(q);
        const matchesCouncil = p.registrations?.some((r) => r.registration_number.includes(q));
        if (!matchesName && !matchesCpf && !matchesEmail && !matchesCouncil) return false;
      }

      return true;
    });
  }, [practitioners, searchTerm, statusFilter, specialtyFilter]);

  // Statistics
  const totalCount = practitioners.length;
  const activeCount = practitioners.filter((p) => p.is_active).length;
  const techLeadCount = practitioners.filter((p) => p.is_technical_lead && p.is_active).length;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          background: '#ffffff',
          padding: '20px 24px',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.45rem',
              border: '1px solid #bae6fd',
            }}
          >
            🩺
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              {t('PRACTITIONERS_TITLE')}
            </h1>
            <div style={{ fontSize: '0.80rem', color: '#64748b', marginTop: 2 }}>
              {t('PRACTITIONERS_SUBTITLE')}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          style={{
            height: 40,
            padding: '0 20px',
            borderRadius: 8,
            border: 'none',
            background: '#0284c7',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
          }}
        >
          ➕ {t('PRACTITIONERS_BTN_NEW')}
        </button>
      </div>

      {/* Metric Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{t('PRACTITIONERS_METRIC_TOTAL')}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{totalCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{t('PRACTITIONERS_METRIC_ACTIVE')}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{activeCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{t('PRACTITIONERS_METRIC_LEAD')}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706', marginTop: 4 }}>{techLeadCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{t('PRACTITIONERS_METRIC_SPECIALTIES')}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0284c7', marginTop: 4 }}>{specialtiesCatalog.length}</div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: '14px 18px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('PRACTITIONERS_SEARCH_PLACEHOLDER')}
            style={{
              width: '100%',
              height: 38,
              padding: '0 14px 0 34px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              color: '#0f172a',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8', fontSize: '0.85rem' }}>
            🔍
          </span>
        </div>

        <select
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
          style={{
            height: 38,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            fontSize: '0.85rem',
            outline: 'none',
          }}
        >
          <option value="ALL">{t('PRACTITIONERS_FILTER_SPECIALTY_ALL')}</option>
          {specialtiesCatalog.map((spec) => (
            <option key={spec.id} value={spec.id}>{spec.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={{
            height: 38,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            fontSize: '0.85rem',
            outline: 'none',
          }}
        >
          <option value="ALL">{t('PRACTITIONERS_FILTER_STATUS_ALL')}</option>
          <option value="ACTIVE">{t('PRACTITIONERS_FILTER_STATUS_ACTIVE')}</option>
          <option value="INACTIVE">{t('PRACTITIONERS_FILTER_STATUS_INACTIVE')}</option>
        </select>
      </div>

      {/* Practitioners Table Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '14px 18px' }}>{t('PRACTITIONERS_COL_NAME')}</th>
                <th style={{ padding: '14px 18px' }}>{t('PRACTITIONERS_COL_COUNCIL')}</th>
                <th style={{ padding: '14px 18px' }}>{t('PRACTITIONERS_COL_SPECIALTY')}</th>
                <th style={{ padding: '14px 18px' }}>{t('PRACTITIONERS_COL_LEAD')}</th>
                <th style={{ padding: '14px 18px' }}>{t('PRACTITIONERS_COL_STATUS')}</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>{t('PRACTITIONERS_COL_ACTIONS')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    {t('PRACTITIONERS_LOADING')}
                  </td>
                </tr>
              ) : filteredPractitioners.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    {t('PRACTITIONERS_EMPTY')}
                  </td>
                </tr>
              ) : (
                filteredPractitioners.map((p) => {
                  const primaryReg = p.registrations?.find((r) => r.is_primary) || p.registrations?.[0];
                  const primarySpec = p.specialties?.find((s) => s.is_primary) || p.specialties?.[0];

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: p.calendar_color || '#0284c7',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              flexShrink: 0,
                            }}
                          >
                            {p.full_name?.charAt(0) || 'M'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              {p.full_name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: 8, alignItems: 'center' }}>
                              {p.cpf && <span>CPF: {p.cpf}</span>}
                              {p.cns && <span>• CNS: {p.cns}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {primaryReg ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '3px 10px',
                              borderRadius: 6,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                            }}
                          >
                            📜 {primaryReg.registration_type}/{primaryReg.registration_state} {primaryReg.registration_number}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{t('PRACTITIONERS_NO_COUNCIL')}</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {primarySpec ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontWeight: 600, color: '#334155' }}>
                              {primarySpec.specialty_name || t('FIELD_SPECIALTY')}
                            </span>
                            {primarySpec.rqe_number ? (
                              <span style={{ fontSize: '0.70rem', color: '#0369a1', fontWeight: 600 }}>
                                RQE: {primarySpec.rqe_number}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.70rem', color: '#94a3b8' }}>{t('PRACTITIONERS_NO_RQE')}</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{t('PRACTITIONERS_GENERAL_SPECIALTY')}</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {p.is_technical_lead ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                            }}
                          >
                            ⭐ RT
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>-</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: p.is_active ? '#dcfce7' : '#fee2e2',
                            color: p.is_active ? '#15803d' : '#b91c1c',
                            border: `1px solid ${p.is_active ? '#bbf7d0' : '#fecaca'}`,
                          }}
                        >
                          {p.is_active ? t('GLOBAL_STATUS_ACTIVE') : t('GLOBAL_STATUS_INACTIVE')}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#334155',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            ✏️ {t('GLOBAL_BTN_EDIT')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTarget(p)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 6,
                              border: '1px solid #fecaca',
                              background: '#fff1f2',
                              color: '#e11d48',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Practitioner Detail Modal */}
      <PractitionerDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingPractitioner}
        isSaving={isSaving}
      />

      {/* Delete Confirmation Modal */}
      {deletingTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
              padding: 24,
              maxWidth: 440,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#0f172a' }}>
              {t('REGISTRIES_CONFIRM_DEACTIVATION_TITLE')}
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
              {t('PRACTITIONERS_DELETE_CONFIRM_DESC', { name: deletingTarget.full_name })}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeletingTarget(null)}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                {t('GLOBAL_BTN_CANCEL')}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{
                  height: 36,
                  padding: '0 18px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                {isDeleting ? t('REGISTRIES_BTN_DEACTIVATING') : t('PRACTITIONERS_DEACTIVATE_BTN')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
