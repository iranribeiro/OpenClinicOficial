import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../i18n/index.js';
import { FieldLabelWithTooltip, ToggleSwitch } from '../../../arch/components/FormControls.js';
import type { OrganizationUnitData, RoomData, RoomType } from './types.js';

interface RoomFormModalProps {
  isOpen: boolean;
  parentUnit: OrganizationUnitData;
  initialData?: RoomData | null;
  onSave: (data: RoomData) => void;
  onClose: () => void;
}

const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: 'CONSULTORIO', label: 'Consultório Médico / Geral' },
  { value: 'PROCEDIMENTO', label: 'Sala de Procedimentos / Curativos' },
  { value: 'EXAME', label: 'Sala de Exames & Diagnóstico' },
  { value: 'TRIAGEM', label: 'Sala de Triagem & Acolhimento' },
  { value: 'CIRURGIA', label: 'Centro / Bloco Cirúrgico' },
  { value: 'ATENDIMENTO', label: 'Box / Sala de Atendimento' },
  { value: 'OUTRO', label: 'Outro Espaço Assistencial' },
];

export const RoomFormModal: React.FC<RoomFormModalProps> = ({
  isOpen,
  parentUnit,
  initialData,
  onSave,
  onClose,
}) => {
  const { t } = useI18n();
  const isEditing = Boolean(initialData);

  const [formData, setFormData] = useState<Partial<RoomData>>({});
  const [errorName, setErrorName] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({
        unitId: parentUnit.id,
        roomType: 'CONSULTORIO',
        isSchedulable: true,
        isActive: true,
      });
    }
    setErrorName(null);
  }, [initialData, parentUnit, isOpen]);

  if (!isOpen) return null;

  const isFormValid = Boolean(formData.name && formData.name.trim().length >= 2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nameTrimmed = (formData.name || '').trim();
    if (!nameTrimmed) {
      setErrorName(t('VALIDATION_ERROR_REQUIRED') || 'Campo obrigatório');
      return;
    }
    if (nameTrimmed.length < 2) {
      setErrorName('O nome deve conter ao menos 2 caracteres.');
      return;
    }

    const roomPayload: RoomData = {
      id: initialData?.id || `room-${Date.now().toString(36)}`,
      unitId: parentUnit.id,
      name: nameTrimmed,
      roomType: formData.roomType || 'CONSULTORIO',
      isSchedulable: formData.isSchedulable ?? true,
      equipmentResources: (formData.equipmentResources || '').trim() || undefined,
      notes: (formData.notes || '').trim() || undefined,
      isActive: formData.isActive ?? true,
    };

    onSave(roomPayload);
  };

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
        zIndex: 9999,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          width: '100%',
          maxWidth: 580,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              {isEditing ? '✏️ Editar Sala / Consultório' : '🚪 Nova Sala / Consultório'}
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Unidade: <strong style={{ color: '#0f172a' }}>{parentUnit.name}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.1rem',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form
          noValidate
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
        >
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Top Operational Settings: Status & Schedulable */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Status Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#1e293b' }}>
                    Status da Sala / Consultório
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    {formData.isActive ?? true
                      ? 'Sala ativa e habilitada para uso no estabelecimento'
                      : 'Sala inativa (temporariamente desabilitada para operações)'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ToggleSwitch
                    checked={formData.isActive ?? true}
                    onChange={(val) => setFormData((prev) => ({ ...prev, isActive: val }))}
                  />
                </div>
              </div>

              {/* Schedulable Checkbox */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  paddingTop: 8,
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <input
                  type="checkbox"
                  id="room-is-schedulable"
                  checked={formData.isSchedulable ?? true}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isSchedulable: e.target.checked }))}
                  style={{ marginTop: 3, width: 16, height: 16, accentColor: '#0284c7', cursor: 'pointer' }}
                />
                <label htmlFor="room-is-schedulable" style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
                    Habilitar agendamento de atendimentos nesta sala
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 1 }}>
                    Se marcado, a sala estará disponível como recurso físico agendável no módulo de Agenda.
                  </div>
                </label>
              </div>
            </div>

            {/* Room Name */}
            <div>
              <FieldLabelWithTooltip
                label="Nome da Sala / Consultório"
                tooltip="Ex: Consultório 101, Sala de Procedimentos A, Box de Coleta"
                required
              />
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({ ...prev, name: val }));
                  if (errorName && val.trim().length >= 2) setErrorName(null);
                }}
                onBlur={() => {
                  const val = (formData.name || '').trim();
                  if (!val) {
                    setErrorName(t('VALIDATION_ERROR_REQUIRED') || 'Campo obrigatório');
                  } else if (val.length < 2) {
                    setErrorName('O nome deve conter ao menos 2 caracteres.');
                  } else {
                    setErrorName(null);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: errorName ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
              {errorName && (
                <div style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: 4 }}>
                  {errorName}
                </div>
              )}
            </div>

            {/* Room Type */}
            <div>
              <FieldLabelWithTooltip
                label="Tipo de Espaço Assistencial"
                tooltip="Finalidade física da sala de acordo com as normas sanitárias e catálogo da clínica"
                required
              />
              <select
                value={formData.roomType || 'CONSULTORIO'}
                onChange={(e) => setFormData((prev) => ({ ...prev, roomType: e.target.value as RoomType }))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  background: '#ffffff',
                  boxSizing: 'border-box',
                }}
              >
                {ROOM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Equipment & Resources */}
            <div>
              <FieldLabelWithTooltip
                label="Equipamentos & Recursos Instalados"
                tooltip="Descreva equipamentos de diagnóstico, mobiliário ou instrumentos presentes no espaço. Ex: Maca ginecológica, foco cirúrgico LED, negatoscópio, eletrocardiógrafo, ultrassom portátil."
              />
              <textarea
                rows={2}
                value={formData.equipmentResources || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, equipmentResources: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Notes */}
            <div>
              <FieldLabelWithTooltip
                label="Observações Administrativas / Técnicas"
                tooltip="Orientações de higienização, limitações de uso ou particularidades do espaço"
              />
              <textarea
                rows={2}
                value={formData.notes || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '14px 22px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              style={{
                background: isFormValid ? '#0284c7' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '8px 18px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#ffffff',
                cursor: isFormValid ? 'pointer' : 'not-allowed',
                opacity: isFormValid ? 1 : 0.6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: isFormValid ? '0 1px 2px rgba(2, 132, 199, 0.2)' : 'none',
              }}
            >
              <span>💾</span>
              <span>Salvar Sala</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default RoomFormModal;
