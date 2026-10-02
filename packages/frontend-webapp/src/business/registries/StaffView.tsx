import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/index.js';
import {
  listStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  type StaffItem,
  type CreateStaffPayload,
} from '../../services/api.js';
import { StaffDetailModal } from './components/StaffDetailModal.js';
import { useToast } from '../../context/ToastContext.js';

export const StaffView: React.FC = () => {
  const { t } = useI18n();

  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [contractFilter, setContractFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingTarget, setDeletingTarget] = useState<StaffItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listStaff();
      setStaffList(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('STAFF_ERROR_LOAD'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingStaff(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: StaffItem) => {
    setEditingStaff(s);
    setIsModalOpen(true);
  };

  const handleSave = async (payload: CreateStaffPayload) => {
    setIsSaving(true);
    try {
      if (editingStaff) {
        await updateStaff(editingStaff.id, payload);
        toast.success(t('STAFF_MSG_UPDATE_SUCCESS'));
      } else {
        await createStaff(payload);
        toast.success(t('STAFF_CREATED_SUCCESS'));
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('STAFF_ERROR_SAVE'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTarget) return;
    setIsDeleting(true);
    try {
      await deleteStaff(deletingTarget.id);
      toast.success(t('STAFF_MSG_DELETE_SUCCESS'));
      setDeletingTarget(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('STAFF_ERROR_DELETE'));
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (statusFilter === 'ACTIVE' && !s.is_active) return false;
      if (statusFilter === 'INACTIVE' && s.is_active) return false;

      if (typeFilter !== 'ALL' && s.staff_type !== typeFilter) return false;
      if (contractFilter !== 'ALL' && s.contract_type !== contractFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = s.full_name?.toLowerCase().includes(q);
        const matchesJob = s.job_position?.toLowerCase().includes(q);
        const matchesDept = s.department?.toLowerCase().includes(q);
        const matchesCpf = s.cpf?.includes(q);
        const matchesEmail = s.email?.toLowerCase().includes(q);
        if (!matchesName && !matchesJob && !matchesDept && !matchesCpf && !matchesEmail) return false;
      }

      return true;
    });
  }, [staffList, searchTerm, typeFilter, contractFilter, statusFilter]);

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
              placeholder={t('STAFF_SEARCH_PLACEHOLDER')}
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

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
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
            <option value="ALL">{t('STAFF_FILTER_TYPE_ALL')}</option>
            <option value="ADMINISTRATIVE">{t('FIELD_STAFF_TYPE_ADMINISTRATIVE')}</option>
            <option value="RECEPTIONIST">{t('FIELD_STAFF_TYPE_RECEPTIONIST')}</option>
            <option value="ASSISTANT">{t('FIELD_STAFF_TYPE_ASSISTANT')}</option>
            <option value="MANAGER">{t('FIELD_STAFF_TYPE_MANAGER')}</option>
            <option value="FINANCIAL">{t('FIELD_STAFF_TYPE_FINANCIAL')}</option>
            <option value="IT_SUPPORT">{t('FIELD_STAFF_TYPE_IT_SUPPORT')}</option>
            <option value="OTHER">{t('FIELD_STAFF_TYPE_OTHER')}</option>
          </select>

          {/* Contract Filter */}
          <select
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value)}
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
            <option value="ALL">{t('STAFF_FILTER_CONTRACT_ALL')}</option>
            <option value="CLT">{t('FIELD_CONTRACT_CLT')}</option>
            <option value="PJ">{t('FIELD_CONTRACT_PJ')}</option>
            <option value="INTERN">{t('FIELD_CONTRACT_INTERN')}</option>
            <option value="TEMPORARY">{t('FIELD_CONTRACT_TEMPORARY')}</option>
            <option value="VOLUNTEER">{t('FIELD_CONTRACT_VOLUNTEER')}</option>
            <option value="OTHER">{t('FIELD_CONTRACT_OTHER')}</option>
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
            <option value="ALL">{t('STAFF_FILTER_STATUS_ALL')}</option>
            <option value="ACTIVE">{t('GLOBAL_STATUS_ACTIVE')}</option>
            <option value="INACTIVE">{t('GLOBAL_STATUS_INACTIVE')}</option>
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
            <span>{t('STAFF_BTN_NEW')}</span>
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
        {!loading && filteredStaff.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(200px, 2fr) minmax(160px, 1.4fr) minmax(120px, 1fr) 110px 110px 90px 200px',
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
            <div>{t('STAFF_COL_NAME')}</div>
            <div>{t('STAFF_COL_ROLE')}</div>
            <div>{t('STAFF_COL_DEPARTMENT')}</div>
            <div>{t('STAFF_COL_CONTRACT')}</div>
            <div>{t('STAFF_COL_ADMISSION')}</div>
            <div>{t('STAFF_COL_STATUS')}</div>
            <div style={{ textAlign: 'right' }}>{t('STAFF_COL_ACTIONS')}</div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>⏳</div>
            <p style={{ margin: 0, fontSize: '0.90rem', fontWeight: 600 }}>{t('STAFF_LOADING')}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredStaff.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>👥</div>
            <p style={{ margin: searchTerm ? '0 0 14px' : 0, fontSize: '0.90rem', fontWeight: 600 }}>
              {searchTerm
                ? 'Nenhum resultado encontrado para a busca informada.'
                : t('STAFF_EMPTY')}
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
        {!loading && filteredStaff.length > 0 && (
          <div>
            {filteredStaff.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(200px, 2fr) minmax(160px, 1.4fr) minmax(120px, 1fr) 110px 110px 90px 200px',
                  padding: '14px 20px',
                  alignItems: 'center',
                  borderBottom: '1px solid #f1f5f9',
                  borderLeft: '4px solid #64748b',
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
                      background: '#e2e8f0',
                      color: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      flexShrink: 0,
                    }}
                  >
                    {s.full_name?.charAt(0) || 'C'}
                  </div>
                  <div style={{ overflow: 'hidden', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.full_name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {s.email}{s.cpf && ` • CPF: ${s.cpf}`}
                    </div>
                  </div>
                </div>

                {/* Role / Type */}
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.82rem' }}>{s.job_position}</div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.70rem',
                      fontWeight: 600,
                      color: '#475569',
                      background: '#f1f5f9',
                      padding: '1px 6px',
                      borderRadius: 4,
                      marginTop: 2,
                    }}
                  >
                    {s.staff_type}
                  </span>
                </div>

                {/* Department */}
                <div style={{ fontSize: '0.82rem', color: '#334155' }}>{s.department || '-'}</div>

                {/* Contract */}
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: s.contract_type === 'CLT' ? '#eff6ff' : '#f0fdf4',
                      color: s.contract_type === 'CLT' ? '#1d4ed8' : '#15803d',
                      border: `1px solid ${s.contract_type === 'CLT' ? '#bfdbfe' : '#bbf7d0'}`,
                    }}
                  >
                    {s.contract_type}
                  </span>
                </div>

                {/* Admission Date */}
                <div style={{ fontSize: '0.80rem', color: '#64748b' }}>
                  {s.hire_date ? s.hire_date.slice(0, 10) : '-'}
                </div>

                {/* Status */}
                <div>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: s.is_active ? '#ecfdf5' : '#fff1f2',
                      color: s.is_active ? '#059669' : '#e11d48',
                      border: `1px solid ${s.is_active ? '#a7f3d0' : '#fecdd3'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.is_active ? '#10b981' : '#ef4444' }} />
                    {s.is_active ? t('GLOBAL_STATUS_ACTIVE') : t('GLOBAL_STATUS_INACTIVE')}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(s)}
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
                    onClick={() => setDeletingTarget(s)}
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
            ))}
          </div>
        )}
      </div>

      {/* Staff Detail Modal */}
      <StaffDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingStaff}
        existingStaff={staffList}
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
                ❓ Ajuda — Equipe / Colaboradores
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
                <strong>Colaboradores</strong> são os membros da equipe administrativa e de apoio da clínica.
              </p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Cadastre recepcionistas, administrativos e pessoal financeiro.</li>
                <li>Defina o tipo de contrato (CLT, PJ, Estagiário, Temporário).</li>
                <li>A data de admissão é usada para relatórios de RH.</li>
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

      {/* Deactivation Confirmation */}
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
              {t('STAFF_DELETE_CONFIRM_DESC', { name: deletingTarget.full_name })}
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
                {isDeleting ? t('REGISTRIES_BTN_DEACTIVATING') : t('STAFF_DEACTIVATE_BTN')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
