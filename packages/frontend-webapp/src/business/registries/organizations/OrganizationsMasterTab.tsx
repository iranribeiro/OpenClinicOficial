import React, { useState, useMemo } from 'react';
import { useI18n } from '../../../i18n/index.js';
import { Cnpj, Phone, Uf } from '@openclinic/core/shared';
import type { OrganizationData, OrganizationUnitData } from './types.js';

interface OrganizationsMasterTabProps {
  organizations: OrganizationData[];
  units: OrganizationUnitData[];
  onSelectOrganization: (orgId: string) => void;
  onOpenCreateOrgModal: () => void;
  onOpenEditOrgModal: (org: OrganizationData) => void;
  onRequestDeleteOrg: (org: OrganizationData) => void;
}

export const OrganizationsMasterTab: React.FC<OrganizationsMasterTabProps> = ({
  organizations,
  units,
  onSelectOrganization,
  onOpenCreateOrgModal,
  onOpenEditOrgModal,
  onRequestDeleteOrg,
}) => {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');

  // Units count map per organization
  const unitsCountMap = useMemo(() => {
    const map: Record<string, { total: number; hqCount: number }> = {};
    for (const u of units) {
      if (!map[u.organizationId]) {
        map[u.organizationId] = { total: 0, hqCount: 0 };
      }
      map[u.organizationId].total += 1;
      if (u.isHeadquarters) {
        map[u.organizationId].hqCount += 1;
      }
    }
    return map;
  }, [units]);

  // Filtered organizations
  const filteredOrganizations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return organizations;
    return organizations.filter(
      (org) =>
        org.tradeName.toLowerCase().includes(term) ||
        org.legalName.toLowerCase().includes(term) ||
        org.cnpj.includes(term) ||
        (org.city && org.city.toLowerCase().includes(term))
    );
  }, [organizations, searchTerm]);

  return (
    <div>
      {/* Action Header & Search */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 260, maxWidth: 440 }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('TENANTS_SEARCH_PLACEHOLDER') || 'Buscar organização por nome, CNPJ ou cidade...'}
            style={{
              width: '100%',
              padding: '9px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              boxSizing: 'border-box',
              background: '#ffffff',
            }}
          />
        </div>

        <button
          type="button"
          onClick={onOpenCreateOrgModal}
          style={{
            background: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            padding: '9px 18px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            transition: 'background 0.15s ease',
          }}
        >
          <span>➕</span>
          <span>{t('ORG_BTN_NEW_ORGANIZATION')}</span>
        </button>
      </div>

      {/* Organizations Grid */}
      {filteredOrganizations.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: '#f8fafc',
            borderRadius: 12,
            border: '1px dashed #cbd5e1',
            color: '#64748b',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏢</div>
          <p style={{ margin: '0 0 16px', fontSize: '0.92rem', fontWeight: 600 }}>
            {t('ORG_EMPTY_LIST')}
          </p>
          <button
            type="button"
            onClick={onOpenCreateOrgModal}
            style={{
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('ORG_BTN_NEW_ORGANIZATION')}
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: 18,
          }}
        >
          {filteredOrganizations.map((org) => {
            const orgUnitsMeta = unitsCountMap[org.id] || { total: 0, hqCount: 0 };

            return (
              <div
                key={org.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div>
                  {/* Top Row: Icon + Trade Name + Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 8,
                          background: '#f0f9ff',
                          color: '#0284c7',
                          border: '1px solid #bae6fd',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.25rem',
                          flexShrink: 0,
                        }}
                      >
                        🏢
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                          {org.tradeName}
                        </h4>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                          {org.legalName}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: org.isActive ? '#ecfdf5' : '#fff1f2',
                        color: org.isActive ? '#059669' : '#e11d48',
                        border: `1px solid ${org.isActive ? '#a7f3d0' : '#fecdd3'}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {org.isActive ? t('ORG_ACTIVE_BADGE') : t('ORG_INACTIVE_BADGE')}
                    </span>
                  </div>

                  {/* Identification Details */}
                  <div
                    style={{
                      background: '#f8fafc',
                      borderRadius: 8,
                      padding: '12px 14px',
                      margin: '14px 0',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: '#64748b' }}>{t('ORG_FIELD_CNPJ_LABEL')}:</span>
                      <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                        {Cnpj.format(org.cnpj)}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: '#64748b' }}>{t('ORG_SECTION_ADDRESS')}:</span>
                      <span style={{ color: '#334155' }}>
                        {[org.city, org.state ? Uf.format(org.state) : null].filter(Boolean).join(' / ') || '-'}
                      </span>
                    </div>

                    {org.phone && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748b' }}>{t('ORG_FIELD_PHONE_LABEL')}:</span>
                        <span style={{ color: '#334155' }}>{Phone.format(org.phone)}</span>
                      </div>
                    )}

                    {org.email && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748b' }}>{t('ORG_FIELD_EMAIL_LABEL')}:</span>
                        <span style={{ color: '#334155', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {org.email}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Units Metric Badge */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: orgUnitsMeta.total > 0 ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${orgUnitsMeta.total > 0 ? '#bbf7d0' : '#fecaca'}`,
                      color: orgUnitsMeta.total > 0 ? '#166534' : '#991b1b',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      marginBottom: 16,
                    }}
                  >
                    <span>📍</span>
                    <span>
                      {t('ORG_UNITS_COUNT_BADGE', { count: orgUnitsMeta.total })}
                      {orgUnitsMeta.hqCount > 0 ? ' (1 Sede)' : ''}
                    </span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: 12,
                    borderTop: '1px solid #f1f5f9',
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectOrganization(org.id)}
                    style={{
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '7px 14px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    <span>📍</span>
                    <span>{t('ORG_BTN_VIEW_UNITS')} ({orgUnitsMeta.total})</span>
                  </button>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => onOpenEditOrgModal(org)}
                      title={t('ORG_BTN_EDIT_ORGANIZATION')}
                      style={{
                        background: '#f8fafc',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestDeleteOrg(org)}
                      title={t('ORG_CONFIRM_DELETE_TITLE')}
                      style={{
                        background: '#f8fafc',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
