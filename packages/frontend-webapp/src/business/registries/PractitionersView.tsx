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
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPractitioner, setEditingPractitioner] = useState<PractitionerItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Top Bar ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Left: Search + Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 }}>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: 260, maxWidth: 380, flex: 1 }}>
            <span
              style={{
                position: 'absolute',
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '0.86rem',
                color: '#94a3b8',
                pointerEvents: 'none',
              }}
            >
              🔍
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('PRACTITIONERS_SEARCH_PLACEHOLDER')}
              style={{
                width: '100%',
                height: 36,
                padding: '0 30px 0 32px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: '0.84rem',
                color: '#0f172a',
                background: '#ffffff',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                title="Limpar busca"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Specialty Filter */}
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            style={{
              height: 36,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: '0.82rem',
              outline: 'none',
            }}
          >
            <option value="ALL">{t('PRACTITIONERS_FILTER_SPECIALTY_ALL')}</option>
            {specialtiesCatalog.map((spec) => (
              <option key={spec.id} value={spec.id}>{spec.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            style={{
              height: 36,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: '0.82rem',
              outline: 'none',
            }}
          >
            <option value="ALL">{t('PRACTITIONERS_FILTER_STATUS_ALL')}</option>
            <option value="ACTIVE">{t('PRACTITIONERS_FILTER_STATUS_ACTIVE')}</option>
            <option value="INACTIVE">{t('PRACTITIONERS_FILTER_STATUS_INACTIVE')}</option>
          </select>
        </div>

        {/* Right: Help + New */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setIsHelpModalOpen(true)}
            style={{
              height: 36,
              background: '#f8fafc',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '0 14px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxSizing: 'border-box',
            }}
            title="Ajuda e orientações sobre este cadastro"
          >
            <span>❓</span>
            <span>Ajuda</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            style={{
              height: 36,
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '0 16px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxSizing: 'border-box',
              boxShadow: '0 1px 3px rgba(2, 132, 199, 0.25)',
            }}
          >
            <span>➕</span>
            <span>{t('PRACTITIONERS_BTN_NEW')}</span>
          </button>
        </div>
      </div>

      {/* ── Main Table ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Column Headers */}
        {!loading && filteredPractitioners.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(240px, 2.5fr) minmax(160px, 1.4fr) minmax(160px, 1.4fr) 80px 100px 200px',
              padding: '12px 20px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              fontSize: '0.74rem',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              alignItems: 'center',
            }}
          >
            <div>{t('PRACTITIONERS_COL_NAME')}</div>
            <div>{t('PRACTITIONERS_COL_COUNCIL')}</div>
            <div>{t('PRACTITIONERS_COL_SPECIALTY')}</div>
            <div>{t('PRACTITIONERS_COL_LEAD')}</div>
            <div>{t('PRACTITIONERS_COL_STATUS')}</div>
            <div style={{ textAlign: 'right' }}>{t('PRACTITIONERS_COL_ACTIONS')}</div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>⏳</div>
            <p style={{ margin: 0, fontSize: '0.90rem', fontWeight: 600 }}>{t('PRACTITIONERS_LOADING')}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredPractitioners.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>🩺</div>
            <p style={{ margin: searchTerm ? '0 0 14px' : 0, fontSize: '0.90rem', fontWeight: 600 }}>
              {searchTerm
                ? 'Nenhum resultado encontrado para a busca informada.'
                : t('PRACTITIONERS_EMPTY')}
            </p>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '7px 14px',
                  fontSize: '0.80rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Limpar Busca
              </button>
            )}
          </div>
        )}

        {/* Rows */}
        {!loading && filteredPractitioners.length > 0 && (
          <div>
            {filteredPractitioners.map((p) => {
              const primaryReg = p.registrations?.find((r) => r.is_primary) || p.registrations?.[0];
              const primarySpec = p.specialties?.find((s) => s.is_primary) || p.specialties?.[0];

              return (
                <div
                  key={p.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(240px, 2.5fr) minmax(160px, 1.4fr) minmax(160px, 1.4fr) 80px 100px 200px',
                    padding: '14px 20px',
                    alignItems: 'center',
                    borderBottom: '1px solid #f1f5f9',
                    borderLeft: `4px solid ${p.calendar_color || '#0284c7'}`,
                    background: '#ffffff',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                >
                  {/* Name + Avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
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
                      {p.full_name?.charAt(0) || 'P'}
                    </div>
                    <div style={{ overflow: 'hidden', minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.full_name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', gap: 6 }}>
                        {p.cpf && <span>CPF: {p.cpf}</span>}
                        {p.cns && <span>• CNS: {p.cns}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Council */}
                  <div>
                    {primaryReg ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 9px',
                          borderRadius: 6,
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          fontWeight: 700,
                          fontSize: '0.76rem',
                        }}
                      >
                        📜 {primaryReg.registration_type}/{primaryReg.registration_state} {primaryReg.registration_number}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>{t('PRACTITIONERS_NO_COUNCIL')}</span>
                    )}
                  </div>

                  {/* Specialty */}
                  <div>
                    {primarySpec ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.82rem' }}>
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
                      <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>{t('PRACTITIONERS_GENERAL_SPECIALTY')}</span>
                    )}
                  </div>

                  {/* Tech Lead */}
                  <div>
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
                          fontSize: '0.70rem',
                        }}
                      >
                        ⭐ RT
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>-</span>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: p.is_active ? '#ecfdf5' : '#fff1f2',
                        color: p.is_active ? '#059669' : '#e11d48',
                        border: `1px solid ${p.is_active ? '#a7f3d0' : '#fecdd3'}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.is_active ? '#10b981' : '#ef4444' }} />
                      {p.is_active ? t('GLOBAL_STATUS_ACTIVE') : t('GLOBAL_STATUS_INACTIVE')}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(p)}
                      style={{
                        background: '#ffffff',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '5px 10px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>✏️</span>
                      <span>{t('GLOBAL_BTN_EDIT')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingTarget(p)}
                      style={{
                        background: '#ffffff',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Practitioner Detail Modal */}
      <PractitionerDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingPractitioner}
        isSaving={isSaving}
      />

      {/* Help Modal */}
      {isHelpModalOpen && (
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
              padding: 28,
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 700 }}>
                ❓ Ajuda — Profissionais de Saúde
              </h3>
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.7 }}>
              <p style={{ margin: '0 0 10px' }}>
                <strong>Profissionais de Saúde</strong> são os médicos, enfermeiros e demais profissionais que realizam atendimentos.
              </p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Cadastre o CRM/CRO e especialidades de cada profissional.</li>
                <li>Defina o <strong>Responsável Técnico (RT)</strong> da clínica.</li>
                <li>O número RQE identifica a especialidade perante o CFM.</li>
              </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                style={{
                  height: 36,
                  padding: '0 18px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
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
