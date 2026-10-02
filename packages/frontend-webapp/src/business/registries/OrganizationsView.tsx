import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/index.js';
import { Cnpj, Cnes, Uf } from '@openclinic/core/shared';
import { useToast } from '../../context/ToastContext.js';
import {
  type OrganizationData,
  type OrganizationUnitData,
  type RoomData,
  ROOM_TYPE_LABELS,
} from './organizations/types.js';
import {
  listOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  listOrganizationUnits,
  createOrganizationUnit,
  updateOrganizationUnit,
  deleteOrganizationUnit,
  listRooms,
  createRoom,
  updateRoom,
  deleteRoom,
} from '../../services/api.js';
import { OrganizationFormModal } from './organizations/OrganizationFormModal.js';
import { OrganizationUnitFormModal } from './organizations/OrganizationUnitFormModal.js';
import { RoomFormModal } from './organizations/RoomFormModal.js';
import { DeleteConfirmationModal } from './organizations/DeleteConfirmationModal.js';
import { OrganizationHelpModal } from './organizations/OrganizationHelpModal.js';

interface OrganizationsViewProps {
  onNavigateTab?: (tabId: string) => void;
}

export const OrganizationsView: React.FC<OrganizationsViewProps> = ({ onNavigateTab }) => {
  const { t } = useI18n();

  // ── Primary Domain State (3-Tier Hierarchy: Organization -> Unit -> Room) ──
  const [organizations, setOrganizations] = useState<OrganizationData[]>([]);
  const [units, setUnits] = useState<OrganizationUnitData[]>([]);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Search Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Accordion Expand State
  const [expandedOrgs, setExpandedOrgs] = useState<Record<string, boolean>>({});
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});

  // Notifications
  const { toast } = useToast();

  // Modal State - Organization
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationData | null>(null);

  // Modal State - Unit
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<OrganizationUnitData | null>(null);
  const [selectedOrgForUnit, setSelectedOrgForUnit] = useState<OrganizationData | null>(null);

  // Modal State - Room
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomData | null>(null);
  const [selectedUnitForRoom, setSelectedUnitForRoom] = useState<OrganizationUnitData | null>(null);

  // Delete Confirmation State
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    type: 'ORGANIZATION' | 'UNIT' | 'ROOM';
    targetId: string;
    targetName: string;
    isBlocked: boolean;
    blockedMessage?: string;
  }>({
    isOpen: false,
    type: 'ORGANIZATION',
    targetId: '',
    targetName: '',
    isBlocked: false,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [orgs, orgUnits, orgRooms] = await Promise.all([
        listOrganizations(),
        listOrganizationUnits(),
        listRooms(),
      ]);
      setOrganizations(orgs);
      setUnits(orgUnits);
      setRooms(orgRooms);
      setExpandedOrgs((prev) => {
        const next = { ...prev };
        for (const org of orgs) {
          if (next[org.id] === undefined) next[org.id] = true;
        }
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar dados das organizações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);


  // ── Global Counts & Filtered Hierarchy ──
  const totalUnitsCount = useMemo(() => units.filter((u) => u.isActive).length, [units]);
  const totalRoomsCount = useMemo(() => rooms.filter((r) => r.isActive).length, [rooms]);

  const filteredOrganizations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return organizations;

    return organizations.filter((org) => {
      // Direct organization match
      const matchOrg =
        org.tradeName.toLowerCase().includes(term) ||
        org.legalName.toLowerCase().includes(term) ||
        org.cnpj.includes(term) ||
        (org.city && org.city.toLowerCase().includes(term));
      if (matchOrg) return true;

      // Child units match
      const orgUnits = units.filter((u) => u.organizationId === org.id);
      const matchUnit = orgUnits.some(
        (u) =>
          u.name.toLowerCase().includes(term) ||
          (u.tradeName && u.tradeName.toLowerCase().includes(term)) ||
          u.cnesCode.includes(term) ||
          (u.city && u.city.toLowerCase().includes(term))
      );
      if (matchUnit) return true;

      // Child rooms match
      const orgUnitIds = new Set(orgUnits.map((u) => u.id));
      const matchRoom = rooms.some(
        (r) =>
          orgUnitIds.has(r.unitId) &&
          (r.name.toLowerCase().includes(term) ||
            r.roomType.toLowerCase().includes(term) ||
            (r.equipmentResources && r.equipmentResources.toLowerCase().includes(term)))
      );
      return matchRoom;
    });
  }, [organizations, units, rooms, searchTerm]);

  // ── Accordion Toggles ──
  const toggleOrg = (orgId: string) => {
    setExpandedOrgs((prev) => ({ ...prev, [orgId]: !prev[orgId] }));
  };

  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  // ── Organization Handlers ──
  const handleOpenCreateOrg = () => {
    setEditingOrg(null);
    setIsOrgModalOpen(true);
  };

  const handleOpenEditOrg = (org: OrganizationData) => {
    setEditingOrg(org);
    setIsOrgModalOpen(true);
  };

  const handleSaveOrg = async (data: OrganizationData, autoCreateHeadquarters: boolean) => {
    try {
      if (editingOrg) {
        await updateOrganization(data.id, data);
        toast.success(t('ORG_MSG_SAVE_SUCCESS'));
      } else {
        await createOrganization(data, autoCreateHeadquarters);
        setExpandedOrgs((prev) => ({ ...prev, [data.id]: true }));
        toast.success(t('ORG_MSG_CREATE_SUCCESS'));
      }
      await loadData();
      setIsOrgModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar organização');
    }
  };

  const handleRequestDeleteOrg = (org: OrganizationData) => {
    // Bottom-Up Deletion Invariant: Units must be deleted first
    const activeUnits = units.filter((u) => u.organizationId === org.id && u.isActive);
    const hasUnits = activeUnits.length > 0;

    setDeleteModalState({
      isOpen: true,
      type: 'ORGANIZATION',
      targetId: org.id,
      targetName: org.tradeName,
      isBlocked: hasUnits,
      blockedMessage: hasUnits ? t('ORG_DELETE_BLOCKED_HAS_UNITS') : undefined,
    });
  };

  const handleConfirmDeleteOrg = async () => {
    const { targetId } = deleteModalState;
    try {
      await deleteOrganization(targetId);
      toast.success(t('ORG_MSG_DELETE_SUCCESS'));
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao desativar organização');
    } finally {
      setDeleteModalState((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // ── Unit Handlers ──
  const handleOpenCreateUnit = (org: OrganizationData) => {
    setSelectedOrgForUnit(org);
    setEditingUnit(null);
    setIsUnitModalOpen(true);
    setExpandedOrgs((prev) => ({ ...prev, [org.id]: true }));
  };

  const handleOpenEditUnit = (unit: OrganizationUnitData) => {
    const parent = organizations.find((o) => o.id === unit.organizationId) || null;
    if (parent) {
      setSelectedOrgForUnit(parent);
      setEditingUnit(unit);
      setIsUnitModalOpen(true);
    }
  };

  const handleSaveUnit = async (data: OrganizationUnitData) => {
    try {
      if (editingUnit) {
        await updateOrganizationUnit(data.id, data);
        toast.success(t('UNIT_MSG_UPDATE_SUCCESS'));
      } else {
        await createOrganizationUnit(data);
        setExpandedUnits((prev) => ({ ...prev, [data.id]: true }));
        toast.success(t('UNIT_MSG_CREATE_SUCCESS'));
      }
      await loadData();
      setIsUnitModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar unidade');
    }
  };

  const handleSetHeadquarters = async (unit: OrganizationUnitData) => {
    try {
      await updateOrganizationUnit(unit.id, { isHeadquarters: true });
      toast.success(t('UNIT_SET_HEADQUARTERS_SUCCESS'));
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao definir unidade sede');
    }
  };

  const handleRequestDeleteUnit = (unit: OrganizationUnitData) => {
    // Check if unit has rooms (bottom-up deletion)
    const activeRooms = rooms.filter((r) => r.unitId === unit.id && r.isActive);
    if (activeRooms.length > 0) {
      setDeleteModalState({
        isOpen: true,
        type: 'UNIT',
        targetId: unit.id,
        targetName: unit.name,
        isBlocked: true,
        blockedMessage: t('UNIT_DELETE_BLOCKED_HAS_ROOMS'),
      });
      return;
    }

    // Check headquarters protection
    const orgUnits = units.filter((u) => u.organizationId === unit.organizationId);
    const isOnlyUnit = orgUnits.length <= 1;
    const isBlocked = unit.isHeadquarters && !isOnlyUnit;

    setDeleteModalState({
      isOpen: true,
      type: 'UNIT',
      targetId: unit.id,
      targetName: unit.name,
      isBlocked,
      blockedMessage: isBlocked ? t('UNIT_TOOLTIP_CANNOT_DELETE_HEADQUARTERS') : undefined,
    });
  };

  const handleConfirmDeleteUnit = async () => {
    const { targetId } = deleteModalState;
    try {
      await deleteOrganizationUnit(targetId);
      toast.success(t('UNIT_MSG_DELETE_SUCCESS'));
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao desativar unidade');
    } finally {
      setDeleteModalState((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // ── Room Handlers ──
  const handleOpenCreateRoom = (unit: OrganizationUnitData) => {
    setSelectedUnitForRoom(unit);
    setEditingRoom(null);
    setIsRoomModalOpen(true);
    setExpandedUnits((prev) => ({ ...prev, [unit.id]: true }));
  };

  const handleOpenEditRoom = (room: RoomData, unit: OrganizationUnitData) => {
    setSelectedUnitForRoom(unit);
    setEditingRoom(room);
    setIsRoomModalOpen(true);
  };

  const handleSaveRoom = async (data: RoomData) => {
    try {
      if (editingRoom) {
        await updateRoom(data.id, data);
        toast.success(t('ROOM_MSG_UPDATE_SUCCESS'));
      } else {
        await createRoom(data);
        toast.success(t('ROOM_MSG_CREATE_SUCCESS'));
      }
      await loadData();
      setIsRoomModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar sala');
    }
  };

  const handleRequestDeleteRoom = (room: RoomData) => {
    setDeleteModalState({
      isOpen: true,
      type: 'ROOM',
      targetId: room.id,
      targetName: room.name,
      isBlocked: false,
    });
  };

  const handleConfirmDeleteRoom = async () => {
    const { targetId } = deleteModalState;
    try {
      await deleteRoom(targetId);
      toast.success(t('ROOM_MSG_DELETE_SUCCESS'));
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao desativar sala');
    } finally {
      setDeleteModalState((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteModalState.type === 'ORGANIZATION') {
      await handleConfirmDeleteOrg();
    } else if (deleteModalState.type === 'UNIT') {
      await handleConfirmDeleteUnit();
    } else {
      await handleConfirmDeleteRoom();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Top Bar Standard (Search + Context Badges + New Org Action) ── */}
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
        {/* Left Side: Search + Scannable Hierarchy Counters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
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
              placeholder="Buscar organização, unidade ou sala..."
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

          {/* Quick Metrics Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                background: '#f0f9ff',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                padding: '4px 10px',
                borderRadius: 14,
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>🏢</span>
              <span>
                {filteredOrganizations.length} {filteredOrganizations.length === 1 ? 'Organização' : 'Organizações'}
              </span>
            </span>

            <span
              style={{
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #e2e8f0',
                padding: '4px 10px',
                borderRadius: 14,
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>📍</span>
              <span>{totalUnitsCount} Unidades</span>
            </span>

            <span
              style={{
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #e2e8f0',
                padding: '4px 10px',
                borderRadius: 14,
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>🚪</span>
              <span>{totalRoomsCount} Salas & Consultórios</span>
            </span>
          </div>
        </div>

        {/* Right Side: Standardized Help Action + Primary New Organization Action */}
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
              justifyContent: 'center',
              gap: 6,
              boxSizing: 'border-box',
              transition: 'background 0.15s ease',
            }}
            title="Ajuda e orientações sobre este cadastro"
          >
            <span>❓</span>
            <span>Ajuda</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateOrg}
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
              justifyContent: 'center',
              gap: 8,
              boxSizing: 'border-box',
              boxShadow: '0 1px 3px rgba(2, 132, 199, 0.25)',
              transition: 'background 0.15s ease',
            }}
          >
            <span>➕</span>
            <span>{t('ORG_BTN_NEW_ORGANIZATION')}</span>
          </button>
        </div>
      </div>

      {/* ── Main Clean Table: 3-Tier Hierarchy (Org -> Unit -> Room) ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Table Column Headers: only visible when there are organizations */}
        {!loading && filteredOrganizations.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(340px, 2.8fr) minmax(180px, 1.2fr) 95px 280px',
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
            <div>Estrutura Assistencial & Identificação</div>
            <div>Localidade / Recursos</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Ações</div>
          </div>
        )}

        {/* Loading State or Empty State */}
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>⏳</div>
            <p style={{ margin: 0, fontSize: '0.90rem', fontWeight: 600 }}>Carregando dados...</p>
          </div>
        ) : filteredOrganizations.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>🏢</div>
            <p style={{ margin: searchTerm ? '0 0 14px' : 0, fontSize: '0.90rem', fontWeight: 600 }}>
              {searchTerm
                ? 'Nenhum resultado encontrado para a busca informada.'
                : 'Nenhuma organização cadastrada.'}
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
        ) : (
          <div>
            {filteredOrganizations.map((org) => {
              const orgUnits = units.filter((u) => u.organizationId === org.id);
              const orgUnitIds = new Set(orgUnits.map((u) => u.id));
              const orgRooms = rooms.filter((r) => orgUnitIds.has(r.unitId));
              const isOrgExpanded = Boolean(expandedOrgs[org.id] || searchTerm.trim().length > 0);

              return (
                <div key={org.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  {/* ── Level 1: Organization Row (Clean White with Primary Blue Accent) ── */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(340px, 2.8fr) minmax(180px, 1.2fr) 95px 280px',
                      padding: '14px 20px',
                      alignItems: 'center',
                      background: '#ffffff',
                      transition: 'background 0.15s ease',
                      borderLeft: '4px solid #0284c7',
                    }}
                  >
                    {/* Structure / Org Name with Embedded Capacity Badges & CNPJ */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => toggleOrg(org.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0284c7',
                          cursor: 'pointer',
                          fontSize: '0.80rem',
                          padding: 2,
                          display: 'inline-flex',
                          alignItems: 'center',
                          flexShrink: 0,
                        }}
                        title={isOrgExpanded ? 'Recolher unidades' : 'Expandir unidades'}
                      >
                        {isOrgExpanded ? '▼' : '▶'}
                      </button>

                      <span style={{ fontSize: '1.25rem', color: '#0284c7', flexShrink: 0 }}>🏢</span>

                      <div style={{ overflow: 'hidden', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0f172a' }}>
                            {org.tradeName}
                          </span>
                          <span
                            style={{
                              background: '#f1f5f9',
                              color: '#334155',
                              padding: '1px 6px',
                              borderRadius: 4,
                              fontSize: '0.70rem',
                              fontWeight: 600,
                            }}
                            title={`${orgUnits.length} unidades vinculadas`}
                          >
                            📍 {orgUnits.length} un.
                          </span>
                          <span
                            style={{
                              background: '#f0fdf4',
                              color: '#166534',
                              padding: '1px 6px',
                              borderRadius: 4,
                              fontSize: '0.70rem',
                              fontWeight: 600,
                            }}
                            title={`${orgRooms.length} salas cadastradas`}
                          >
                            🚪 {orgRooms.length} salas
                          </span>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                          {org.legalName} • <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>CNPJ: {Cnpj.format(org.cnpj)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Location */}
                    <div style={{ fontSize: '0.80rem', color: '#475569' }}>
                      {[org.city, org.state ? Uf.format(org.state) : null].filter(Boolean).join('/') || '-'}
                    </div>

                    {/* Status */}
                    <div>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: org.isActive ? '#ecfdf5' : '#fff1f2',
                          color: org.isActive ? '#059669' : '#e11d48',
                          border: `1px solid ${org.isActive ? '#a7f3d0' : '#fecdd3'}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: org.isActive ? '#10b981' : '#ef4444',
                          }}
                        />
                        {org.isActive ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateUnit(org)}
                        style={{
                          background: '#f0fdf4',
                          color: '#15803d',
                          border: '1px solid #bbf7d0',
                          borderRadius: 6,
                          padding: '5px 10px',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                        title="Adicionar unidade nesta organização"
                      >
                        <span>➕</span>
                        <span>Nova Unidade</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditOrg(org)}
                        style={{
                          background: '#ffffff',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          padding: '5px 8px',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                        title={t('ORG_BTN_EDIT_ORGANIZATION')}
                      >
                        ✏️
                      </button>

                      {(() => {
                        const hasUnits = orgUnits.length > 0;
                        return (
                          <button
                            type="button"
                            disabled={hasUnits}
                            onClick={() => !hasUnits && handleRequestDeleteOrg(org)}
                            style={{
                              background: hasUnits ? '#f8fafc' : '#ffffff',
                              color: hasUnits ? '#94a3b8' : '#dc2626',
                              border: `1px solid ${hasUnits ? '#e2e8f0' : '#fecaca'}`,
                              borderRadius: 6,
                              padding: '5px 8px',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              cursor: hasUnits ? 'not-allowed' : 'pointer',
                              opacity: hasUnits ? 0.45 : 1,
                              flexShrink: 0,
                            }}
                            title={
                              hasUnits
                                ? t('ORG_DELETE_BLOCKED_HAS_UNITS')
                                : t('ORG_CONFIRM_DELETE_TITLE')
                            }
                          >
                            🗑️
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ── Level 2: Child Units (Progressive Disclosure) ── */}
                  {isOrgExpanded && (
                    <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                      {orgUnits.length === 0 ? (
                        <div style={{ padding: '14px 20px 14px 48px', fontSize: '0.80rem', color: '#64748b' }}>
                          Nenhuma unidade cadastrada nesta organização.{' '}
                          <button
                            type="button"
                            onClick={() => handleOpenCreateUnit(org)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#0284c7',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            + Cadastrar Primeira Unidade
                          </button>
                        </div>
                      ) : (
                        orgUnits.map((unit) => {
                          const isUnitExpanded = Boolean(expandedUnits[unit.id] || searchTerm.trim().length > 0);
                          const unitRooms = rooms.filter((r) => r.unitId === unit.id);
                          const isHq = unit.isHeadquarters;

                          return (
                            <div key={unit.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              {/* ── Level 2: Unit Row (Soft Sky/Teal Tint with Distinct Cyan Accent) ── */}
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(340px, 2.8fr) minmax(180px, 1.2fr) 95px 280px',
                                  padding: '11px 20px 11px 36px',
                                  alignItems: 'center',
                                  background: isUnitExpanded ? '#f0f9ff' : '#f8fafc',
                                  borderLeft: '4px solid #0ea5e9',
                                  transition: 'background 0.15s ease',
                                }}
                              >
                                {/* Structure / Unit Name with Embedded Capacity + CNES */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => toggleUnit(unit.id)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#0369a1',
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
                                      padding: 2,
                                      flexShrink: 0,
                                    }}
                                    title={isUnitExpanded ? 'Recolher salas' : 'Expandir salas'}
                                  >
                                    {isUnitExpanded ? '▼' : '▶'}
                                  </button>

                                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>{isHq ? '⭐' : '📍'}</span>

                                  <div style={{ overflow: 'hidden', minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
                                        {unit.name}
                                      </span>
                                      <span
                                        style={{
                                          padding: '1px 6px',
                                          borderRadius: 4,
                                          fontSize: '0.66rem',
                                          fontWeight: 700,
                                          background: isHq ? '#fef3c7' : '#e2e8f0',
                                          color: isHq ? '#b45309' : '#475569',
                                        }}
                                      >
                                        {isHq ? 'SEDE' : 'FILIAL'}
                                      </span>
                                      <span
                                        style={{
                                          padding: '1px 6px',
                                          borderRadius: 4,
                                          fontSize: '0.68rem',
                                          fontWeight: 600,
                                          background: '#ffffff',
                                          border: '1px solid #cbd5e1',
                                          color: '#334155',
                                          fontFamily: 'monospace',
                                        }}
                                        title="Código Nacional de Estabelecimento de Saúde"
                                      >
                                        CNES: {Cnes.format(unit.cnesCode)}
                                      </span>
                                      <span
                                        style={{
                                          background: '#ffffff',
                                          border: '1px solid #cbd5e1',
                                          color: '#0f172a',
                                          padding: '1px 6px',
                                          borderRadius: 4,
                                          fontSize: '0.68rem',
                                          fontWeight: 600,
                                        }}
                                        title={`${unitRooms.length} salas cadastradas nesta unidade`}
                                      >
                                        🚪 {unitRooms.length} salas
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Location */}
                                <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                                  {[unit.neighborhood, unit.city].filter(Boolean).join(', ') || '-'}
                                </div>

                                {/* Status */}
                                <div>
                                  <span
                                    style={{
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                      fontSize: '0.70rem',
                                      fontWeight: 600,
                                      background: unit.isActive ? '#ecfdf5' : '#f1f5f9',
                                      color: unit.isActive ? '#059669' : '#64748b',
                                    }}
                                  >
                                    {unit.isActive ? 'Ativa' : 'Inativa'}
                                  </span>
                                </div>

                                {/* Unit Actions */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCreateRoom(unit)}
                                    style={{
                                      background: '#f0f9ff',
                                      color: '#0284c7',
                                      border: '1px solid #bae6fd',
                                      borderRadius: 6,
                                      padding: '5px 10px',
                                      fontSize: '0.74rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                    }}
                                    title="Adicionar sala ou consultório nesta unidade"
                                  >
                                    <span>➕</span>
                                    <span>Nova Sala/Consultório</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditUnit(unit)}
                                    style={{
                                      background: '#ffffff',
                                      color: '#475569',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: 6,
                                      padding: '4px 7px',
                                      fontSize: '0.74rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      flexShrink: 0,
                                    }}
                                    title={t('UNIT_BTN_EDIT')}
                                  >
                                    ✏️
                                  </button>

                                  {(() => {
                                    const hasRooms = unitRooms.length > 0;
                                    const isBlockedHq = isHq && orgUnits.length > 1;
                                    const isDeleteDisabled = hasRooms || isBlockedHq;
                                    const deleteTitle = hasRooms
                                      ? t('UNIT_DELETE_BLOCKED_HAS_ROOMS')
                                      : isBlockedHq
                                      ? t('UNIT_TOOLTIP_CANNOT_DELETE_HEADQUARTERS')
                                      : t('UNIT_BTN_DELETE');

                                    return (
                                      <button
                                        type="button"
                                        disabled={isDeleteDisabled}
                                        onClick={() => !isDeleteDisabled && handleRequestDeleteUnit(unit)}
                                        style={{
                                          background: isDeleteDisabled ? '#f8fafc' : '#ffffff',
                                          color: isDeleteDisabled ? '#94a3b8' : '#dc2626',
                                          border: `1px solid ${isDeleteDisabled ? '#e2e8f0' : '#fecaca'}`,
                                          borderRadius: 6,
                                          padding: '4px 7px',
                                          fontSize: '0.74rem',
                                          fontWeight: 600,
                                          cursor: isDeleteDisabled ? 'not-allowed' : 'pointer',
                                          opacity: isDeleteDisabled ? 0.45 : 1,
                                          flexShrink: 0,
                                        }}
                                        title={deleteTitle}
                                      >
                                        🗑️
                                      </button>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* ── Level 3: Child Rooms & Consultórios (Nested Soft Slate Tint) ── */}
                              {isUnitExpanded && (
                                <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                                  {unitRooms.length === 0 ? (
                                    <div style={{ padding: '12px 20px 12px 64px', fontSize: '0.78rem', color: '#64748b' }}>
                                      Nenhuma sala ou consultório cadastrado nesta unidade.{' '}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenCreateRoom(unit)}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: '#0284c7',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          padding: 0,
                                        }}
                                      >
                                        + Cadastrar Sala/Consultório
                                      </button>
                                    </div>
                                  ) : (
                                    unitRooms.map((room) => (
                                      <div
                                        key={room.id}
                                        style={{
                                          display: 'grid',
                                          gridTemplateColumns: 'minmax(340px, 2.8fr) minmax(180px, 1.2fr) 95px 280px',
                                          padding: '8px 20px 8px 60px',
                                          alignItems: 'center',
                                          background: '#f1f5f9',
                                          borderBottom: '1px solid #e2e8f0',
                                          borderLeft: '4px solid #94a3b8',
                                          fontSize: '0.80rem',
                                        }}
                                      >
                                        {/* Room Name with Room Type & Schedulable Tag */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: '0.90rem', color: '#64748b', flexShrink: 0 }}>🚪</span>
                                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{room.name}</span>
                                          <span
                                            style={{
                                              padding: '1px 6px',
                                              borderRadius: 4,
                                              fontSize: '0.70rem',
                                              fontWeight: 600,
                                              background: '#ffffff',
                                              color: '#334155',
                                              border: '1px solid #cbd5e1',
                                            }}
                                          >
                                            {ROOM_TYPE_LABELS[room.roomType] || room.roomType}
                                          </span>
                                          {room.isSchedulable ? (
                                            <span style={{ color: '#059669', fontSize: '0.68rem', fontWeight: 600, background: '#ecfdf5', padding: '1px 6px', borderRadius: 4, border: '1px solid #a7f3d0' }}>
                                              🗓️ Agendável
                                            </span>
                                          ) : (
                                            <span style={{ color: '#64748b', fontSize: '0.68rem', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>
                                              🔒 Não agendável
                                            </span>
                                          )}
                                        </div>

                                        {/* Equipment Resources / Notes Preview */}
                                        <div
                                          style={{
                                            fontSize: '0.76rem',
                                            color: '#64748b',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            paddingRight: 8,
                                          }}
                                          title={room.equipmentResources || room.notes || 'Sem observações'}
                                        >
                                          {room.equipmentResources || room.notes || '-'}
                                        </div>

                                        {/* Status */}
                                        <div>
                                          <span
                                            style={{
                                              padding: '1px 6px',
                                              borderRadius: 4,
                                              fontSize: '0.68rem',
                                              fontWeight: 600,
                                              background: room.isActive ? '#ecfdf5' : '#fef2f2',
                                              color: room.isActive ? '#059669' : '#dc2626',
                                            }}
                                          >
                                            {room.isActive ? 'Ativa' : 'Inativa'}
                                          </span>
                                        </div>

                                        {/* Room Actions */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, alignItems: 'center' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenEditRoom(room, unit)}
                                            style={{
                                              background: '#ffffff',
                                              border: '1px solid #cbd5e1',
                                              borderRadius: 6,
                                              padding: '4px 7px',
                                              fontSize: '0.72rem',
                                              color: '#475569',
                                              cursor: 'pointer',
                                              flexShrink: 0,
                                            }}
                                            title={t('ROOM_BTN_EDIT')}
                                          >
                                            ✏️
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRequestDeleteRoom(room)}
                                            style={{
                                              background: '#ffffff',
                                              border: '1px solid #fecaca',
                                              borderRadius: 6,
                                              padding: '4px 7px',
                                              fontSize: '0.72rem',
                                              color: '#dc2626',
                                              cursor: 'pointer',
                                              flexShrink: 0,
                                            }}
                                            title={t('ROOM_BTN_DELETE')}
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {/* Organization Modal */}
      <OrganizationFormModal
        isOpen={isOrgModalOpen}
        initialData={editingOrg}
        onSave={handleSaveOrg}
        onClose={() => setIsOrgModalOpen(false)}
        onNavigateToGeneralHelp={() => onNavigateTab?.('account_help')}
      />

      {/* Unit Modal */}
      {selectedOrgForUnit && (
        <OrganizationUnitFormModal
          isOpen={isUnitModalOpen}
          parentOrganization={selectedOrgForUnit}
          initialData={editingUnit}
          onSave={handleSaveUnit}
          onClose={() => setIsUnitModalOpen(false)}
        />
      )}

      {/* Room Modal */}
      {selectedUnitForRoom && (
        <RoomFormModal
          isOpen={isRoomModalOpen}
          parentUnit={selectedUnitForRoom}
          initialData={editingRoom}
          onSave={handleSaveRoom}
          onClose={() => setIsRoomModalOpen(false)}
        />
      )}

      {/* Generic Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        title={
          deleteModalState.type === 'ORGANIZATION'
            ? t('ORG_CONFIRM_DELETE_TITLE')
            : deleteModalState.type === 'UNIT'
            ? t('UNIT_CONFIRM_DELETE_TITLE')
            : t('ROOM_CONFIRM_DELETE_TITLE')
        }
        message={
          deleteModalState.type === 'ORGANIZATION'
            ? t('ORG_CONFIRM_DELETE_MSG', { name: deleteModalState.targetName })
            : deleteModalState.type === 'UNIT'
            ? t('UNIT_CONFIRM_DELETE_MSG', { name: deleteModalState.targetName })
            : t('ROOM_CONFIRM_DELETE_MSG', { name: deleteModalState.targetName })
        }
        isBlocked={deleteModalState.isBlocked}
        blockedMessage={deleteModalState.blockedMessage}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Contextual Help Guide Modal */}
      <OrganizationHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        onNavigateToGeneralHelp={() => onNavigateTab?.('account_help')}
      />
    </div>
  );
};

export default OrganizationsView;
