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
  const { toast } = useToast();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [contractFilter, setContractFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Deletion Confirmation
  const [deletingTarget, setDeletingTarget] = useState<StaffItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listStaff();
      setStaffList(data);
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
        const matchesJob = s.job_title?.toLowerCase().includes(q);
        const matchesDept = s.department?.toLowerCase().includes(q);
        const matchesCpf = s.cpf?.includes(q);
        const matchesEmail = s.email?.toLowerCase().includes(q);
        if (!matchesName && !matchesJob && !matchesDept && !matchesCpf && !matchesEmail) return false;
      }

      return true;
    });
  }, [staffList, searchTerm, typeFilter, contractFilter, statusFilter]);

  // Statistics
  const totalCount = staffList.length;
  const activeCount = staffList.filter((s) => s.is_active).length;
  const receptionCount = staffList.filter((s) => s.staff_type === 'RECEPTIONIST').length;
  const financialCount = staffList.filter((s) => s.staff_type === 'FINANCIAL').length;

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
              background: '#f1f5f9',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.45rem',
              border: '1px solid #cbd5e1',
            }}
          >
            👥
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              {t('STAFF_TITLE')}
            </h1>
            <div style={{ fontSize: '0.80rem', color: '#64748b', marginTop: 2 }}>
              {t('STAFF_SUBTITLE')}
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
          ➕ {t('STAFF_BTN_NEW')}
        </button>
      </div>

      {/* Metric Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{t('STAFF_METRIC_TOTAL')}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{totalCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{t('STAFF_METRIC_ACTIVE')}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{activeCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{t('STAFF_METRIC_RECEPTION')}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0284c7', marginTop: 4 }}>{receptionCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{t('STAFF_METRIC_FINANCIAL')}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#7c3aed', marginTop: 4 }}>{financialCount}</div>
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
            placeholder={t('STAFF_SEARCH_PLACEHOLDER')}
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
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
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
          <option value="ALL">{t('STAFF_FILTER_TYPE_ALL')}</option>
          <option value="RECEPTIONIST">{t('FIELD_STAFF_TYPE_RECEPTIONIST')}</option>
          <option value="ADMINISTRATIVE">{t('FIELD_STAFF_TYPE_ADMINISTRATIVE')}</option>
          <option value="FINANCIAL">{t('FIELD_STAFF_TYPE_FINANCIAL')}</option>
          <option value="NURSE_TECH">{t('FIELD_STAFF_TYPE_NURSE_TECH')}</option>
          <option value="OTHER">{t('FIELD_STAFF_TYPE_OTHER')}</option>
        </select>

        <select
          value={contractFilter}
          onChange={(e) => setContractFilter(e.target.value)}
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
          <option value="ALL">{t('STAFF_FILTER_CONTRACT_ALL')}</option>
          <option value="CLT">{t('FIELD_CONTRACT_CLT')}</option>
          <option value="PJ">{t('FIELD_CONTRACT_PJ')}</option>
          <option value="INTERN">{t('FIELD_CONTRACT_INTERN')}</option>
          <option value="TEMPORARY">{t('FIELD_CONTRACT_TEMPORARY')}</option>
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
          <option value="ALL">{t('STAFF_FILTER_STATUS_ALL')}</option>
          <option value="ACTIVE">{t('GLOBAL_STATUS_ACTIVE')}</option>
          <option value="INACTIVE">{t('GLOBAL_STATUS_INACTIVE')}</option>
        </select>
      </div>

      {/* Staff Table Card */}
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
                <th style={{ padding: '14px 18px' }}>{t('STAFF_COL_NAME')}</th>
                <th style={{ padding: '14px 18px' }}>{t('STAFF_COL_ROLE')}</th>
                <th style={{ padding: '14px 18px' }}>{t('STAFF_COL_DEPARTMENT')}</th>
                <th style={{ padding: '14px 18px' }}>{t('STAFF_COL_CONTRACT')}</th>
                <th style={{ padding: '14px 18px' }}>{t('STAFF_COL_ADMISSION')}</th>
                <th style={{ padding: '14px 18px' }}>{t('STAFF_COL_STATUS')}</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>{t('STAFF_COL_ACTIONS')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    {t('STAFF_LOADING')}
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    {t('STAFF_EMPTY')}
                  </td>
                </tr>
              ) : (
                filteredStaff.map((s) => (
                  <tr
                    key={s.id}
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
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{s.full_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {s.email} {s.cpf && `• CPF: ${s.cpf}`}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.job_title}</div>
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
                    </td>

                    <td style={{ padding: '14px 18px', color: '#334155' }}>
                      {s.department}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
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
                    </td>

                    <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '0.80rem' }}>
                      {s.admission_date ? s.admission_date.slice(0, 10) : '-'}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: s.is_active ? '#dcfce7' : '#fee2e2',
                          color: s.is_active ? '#15803d' : '#b91c1c',
                          border: `1px solid ${s.is_active ? '#bbf7d0' : '#fecaca'}`,
                        }}
                      >
                        {s.is_active ? t('GLOBAL_STATUS_ACTIVE') : t('GLOBAL_STATUS_INACTIVE')}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(s)}
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
                          onClick={() => setDeletingTarget(s)}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Detail Modal */}
      <StaffDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingStaff}
        isSaving={isSaving}
      />

      {/* Deactivation Confirmation Modal */}
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
