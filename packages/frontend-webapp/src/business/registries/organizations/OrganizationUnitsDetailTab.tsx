import React from 'react';
import { useI18n } from '../../../i18n/index.js';
import { Cnpj, Cnes, Phone, Cep, Uf } from '@openclinic/core/shared';
import type { OrganizationData, OrganizationUnitData } from './types.js';

interface OrganizationUnitsDetailTabProps {
  organizations: OrganizationData[];
  selectedOrgId: string;
  units: OrganizationUnitData[];
  onSelectOrganization: (orgId: string) => void;
  onOpenCreateUnitModal: () => void;
  onOpenEditUnitModal: (unit: OrganizationUnitData) => void;
  onRequestDeleteUnit: (unit: OrganizationUnitData) => void;
  onSetHeadquarters: (unit: OrganizationUnitData) => void;
}

export const OrganizationUnitsDetailTab: React.FC<OrganizationUnitsDetailTabProps> = ({
  organizations,
  selectedOrgId,
  units,
  onSelectOrganization,
  onOpenCreateUnitModal,
  onOpenEditUnitModal,
  onRequestDeleteUnit,
  onSetHeadquarters,
}) => {
  const { t } = useI18n();

  const activeOrg = organizations.find((o) => o.id === selectedOrgId) || organizations[0];
  const orgUnits = activeOrg ? units.filter((u) => u.organizationId === activeOrg.id) : [];

  if (!activeOrg) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
        {t('ORG_EMPTY_LIST')}
      </div>
    );
  }

  return (
    <div>
      {/* Context Selector Bar */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', flex: 1 }}>
          <div style={{ minWidth: 220 }}>
            <label
              htmlFor="org-context-select"
              style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginBottom: 4 }}
            >
              {t('ORG_ACTIVE_CONTEXT_LABEL')}
            </label>
            <select
              id="org-context-select"
              value={activeOrg.id}
              onChange={(e) => onSelectOrganization(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #0284c7',
                background: '#ffffff',
                fontSize: '0.86rem',
                fontWeight: 600,
                color: '#0f172a',
                cursor: 'pointer',
              }}
            >
              {organizations.map((org) => {
                const count = units.filter((u) => u.organizationId === org.id).length;
                return (
                  <option key={org.id} value={org.id}>
                    🏢 {org.tradeName} ({count} {count === 1 ? 'unidade' : 'unidades'})
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
              {activeOrg.legalName}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
              CNPJ Matriz: <span style={{ fontFamily: 'monospace' }}>{Cnpj.format(activeOrg.cnpj)}</span> • {orgUnits.length} estabelecimentos cadastrados
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCreateUnitModal}
          style={{
            background: '#16a34a',
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
          }}
        >
          <span>➕</span>
          <span>{t('ORG_BTN_NEW_UNIT')}</span>
        </button>
      </div>

      {/* Units List */}
      {orgUnits.length === 0 ? (
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
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📍</div>
          <p style={{ margin: '0 0 16px', fontSize: '0.92rem', fontWeight: 600 }}>
            {t('UNIT_EMPTY_LIST')}
          </p>
          <button
            type="button"
            onClick={onOpenCreateUnitModal}
            style={{
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('ORG_BTN_NEW_UNIT')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 18 }}>
          {orgUnits.map((unit) => {
            const isHq = unit.isHeadquarters;

            return (
              <div
                key={unit.id}
                style={{
                  background: '#ffffff',
                  border: isHq ? '1.5px solid #38bdf8' : '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isHq
                    ? '0 4px 6px -1px rgba(56, 189, 248, 0.15), 0 2px 4px -2px rgba(56, 189, 248, 0.1)'
                    : '0 1px 3px rgba(0, 0, 0, 0.05)',
                  position: 'relative',
                }}
              >
                <div>
                  {/* Top Badge & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: isHq ? '#fef3c7' : '#f1f5f9',
                          color: isHq ? '#b45309' : '#475569',
                          border: `1px solid ${isHq ? '#fde68a' : '#e2e8f0'}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {isHq ? '⭐ ' + t('UNIT_BADGE_HEADQUARTERS') : '📍 ' + t('UNIT_BADGE_BRANCH')}
                      </span>

                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: '#f0f9ff',
                          color: '#0284c7',
                          border: '1px solid #bae6fd',
                          fontFamily: 'monospace',
                        }}
                      >
                        CNES: {Cnes.format(unit.cnesCode)}
                      </span>
                    </div>

                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: unit.isActive ? '#ecfdf5' : '#fff1f2',
                        color: unit.isActive ? '#059669' : '#e11d48',
                        border: `1px solid ${unit.isActive ? '#a7f3d0' : '#fecdd3'}`,
                      }}
                    >
                      {unit.isActive ? t('GLOBAL_STATUS_ACTIVE') : t('GLOBAL_STATUS_INACTIVE')}
                    </span>
                  </div>

                  {/* Unit Title */}
                  <h4 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                    {unit.name}
                  </h4>
                  {unit.tradeName && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 12 }}>
                      {unit.tradeName}
                    </div>
                  )}

                  {/* Unit Information Box */}
                  <div
                    style={{
                      background: '#f8fafc',
                      borderRadius: 8,
                      padding: '12px 14px',
                      margin: '12px 0 16px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: '#64748b' }}>{t('UNIT_FIELD_CNPJ_LABEL')}:</span>
                      <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                        {unit.cnpj ? Cnpj.format(unit.cnpj) : `${Cnpj.format(activeOrg.cnpj)} (Matriz)`}
                      </strong>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                      <span style={{ color: '#64748b' }}>Endereço: </span>
                      {unit.street ? `${unit.street}, ${unit.number || 'S/N'}` : '-'}
                      {unit.complement ? ` • ${unit.complement}` : ''}
                      {unit.neighborhood ? ` — ${unit.neighborhood}` : ''}
                      {unit.city ? `, ${unit.city}/${unit.state ? Uf.format(unit.state) : ''}` : ''}
                      {unit.postalCode ? ` (CEP: ${Cep.format(unit.postalCode)})` : ''}
                    </div>

                    {unit.phone && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748b' }}>{t('UNIT_FIELD_PHONE_LABEL')}:</span>
                        <span style={{ color: '#334155' }}>{Phone.format(unit.phone)}</span>
                      </div>
                    )}

                    {unit.email && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748b' }}>{t('UNIT_FIELD_EMAIL_LABEL')}:</span>
                        <span style={{ color: '#334155', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {unit.email}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Unit Actions Footer */}
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
                  <div>
                    {!isHq && (
                      <button
                        type="button"
                        onClick={() => onSetHeadquarters(unit)}
                        style={{
                          background: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          borderRadius: 6,
                          padding: '6px 10px',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>⭐</span>
                        <span>{t('UNIT_BTN_SET_HEADQUARTERS')}</span>
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => onOpenEditUnitModal(unit)}
                      title={t('UNIT_BTN_EDIT')}
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
                      onClick={() => onRequestDeleteUnit(unit)}
                      title={t('UNIT_BTN_DELETE')}
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
