import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../../i18n/index.js';
import type { PractitionerAvailabilityItem } from '../../../services/api.js';
import type { OrganizationUnitData } from '../organizations/types.js';

export interface PractitionerUnitsScheduleTabProps {
  units: OrganizationUnitData[];
  unitsLoading: boolean;
  unitsError: boolean;
  availability: PractitionerAvailabilityItem[];
  onChange: (next: PractitionerAvailabilityItem[]) => void;
}

// Sunday is 0 to match the availability table; the week is rendered Monday-first.
// Each day carries a full label for the editor and a short one for the summary report.
const DAYS_OF_WEEK = [
  { id: 1, labelKey: 'DAY_MONDAY', shortKey: 'DAY_SHORT_MONDAY' },
  { id: 2, labelKey: 'DAY_TUESDAY', shortKey: 'DAY_SHORT_TUESDAY' },
  { id: 3, labelKey: 'DAY_WEDNESDAY', shortKey: 'DAY_SHORT_WEDNESDAY' },
  { id: 4, labelKey: 'DAY_THURSDAY', shortKey: 'DAY_SHORT_THURSDAY' },
  { id: 5, labelKey: 'DAY_FRIDAY', shortKey: 'DAY_SHORT_FRIDAY' },
  { id: 6, labelKey: 'DAY_SATURDAY', shortKey: 'DAY_SHORT_SATURDAY' },
  { id: 0, labelKey: 'DAY_SUNDAY', shortKey: 'DAY_SHORT_SUNDAY' },
] as const;

const SLOT_DURATIONS = [15, 20, 30, 45, 60] as const;
const DEFAULT_START_TIME = '08:00';
const DEFAULT_END_TIME = '12:00';
const DEFAULT_SLOT_DURATION = 30;
const DEFAULT_SHIFT_MINUTES = 240;
const LAST_MINUTE_OF_DAY = 23 * 60 + 59;

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const minutesToTime = (total: number): string => {
  const clamped = Math.max(0, Math.min(total, LAST_MINUTE_OF_DAY));
  const hours = String(Math.floor(clamped / 60)).padStart(2, '0');
  const minutes = String(clamped % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
};

/** Whole hours, or one decimal when the schedule has a half-hour tail (e.g. 32.5). */
const formatHours = (minutes: number): string => (minutes / 60).toFixed(1).replace(/\.0$/, '');

/** A shift plus its position in the flat availability array. */
interface IndexedRange {
  item: PractitionerAvailabilityItem;
  index: number;
}

const panelStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
};

const panelMessageStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '0.75rem',
  lineHeight: 1.45,
  color: '#64748b',
};

const timeInputStyle: React.CSSProperties = {
  width: 82,
  height: 30,
  padding: '0 4px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '0.76rem',
  fontFamily: 'monospace',
  boxSizing: 'border-box',
};

/**
 * Master-detail editor that links a practitioner to organization units and, per unit,
 * to weekday shifts. The flat `availability` array is the single source of truth
 * (one entry per unit + weekday + shift), mirroring the persistence model.
 */
export const PractitionerUnitsScheduleTab: React.FC<PractitionerUnitsScheduleTabProps> = ({
  units,
  unitsLoading,
  unitsError,
  availability,
  onChange,
}) => {
  const { t } = useI18n();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [unlinkConfirmingId, setUnlinkConfirmingId] = useState<string | null>(null);

  const activeUnits = useMemo(() => units.filter((unit) => unit.isActive), [units]);

  const rangesByUnit = useMemo(() => {
    const map = new Map<string, IndexedRange[]>();
    availability.forEach((item, index) => {
      const key = item.organization_unit_id ?? '';
      const existing = map.get(key);
      if (existing) existing.push({ item, index });
      else map.set(key, [{ item, index }]);
    });
    return map;
  }, [availability]);

  const linkedUnits = useMemo(
    () => activeUnits.filter((unit) => rangesByUnit.has(unit.id)),
    [activeUnits, rangesByUnit]
  );
  const availableUnits = useMemo(
    () => activeUnits.filter((unit) => !rangesByUnit.has(unit.id)),
    [activeUnits, rangesByUnit]
  );
  const selectedUnit = linkedUnits.find((unit) => unit.id === selectedUnitId) ?? null;

  // Drop the selection when its unit stops being linked (unlinked here or removed upstream).
  useEffect(() => {
    if (selectedUnitId && !linkedUnits.some((unit) => unit.id === selectedUnitId)) {
      setSelectedUnitId(null);
      setUnlinkConfirmingId(null);
    }
  }, [linkedUnits, selectedUnitId]);

  const unitRanges = selectedUnit ? rangesByUnit.get(selectedUnit.id) ?? [] : [];
  const unitDuration = unitRanges[0]?.item.slot_duration_minutes ?? DEFAULT_SLOT_DURATION;

  // Whole-schedule overview rendered below the editor, so the practitioner's configuration
  // can be read at a glance without opening each unit in the detail pane.
  const summary = useMemo(
    () =>
      linkedUnits.map((unit) => {
        const ranges = rangesByUnit.get(unit.id) ?? [];
        const days = DAYS_OF_WEEK.map((day) => ({
          id: day.id,
          shortKey: day.shortKey,
          ranges: ranges
            .filter((range) => range.item.day_of_week === day.id)
            .sort((a, b) => timeToMinutes(a.item.start_time) - timeToMinutes(b.item.start_time)),
        })).filter((day) => day.ranges.length > 0);
        const minutes = ranges.reduce(
          (total, range) =>
            total + Math.max(0, timeToMinutes(range.item.end_time) - timeToMinutes(range.item.start_time)),
          0
        );
        return { unit, rangeCount: ranges.length, minutes, days };
      }),
    [linkedUnits, rangesByUnit]
  );

  const totalRanges = summary.reduce((total, entry) => total + entry.rangeCount, 0);
  const totalMinutes = summary.reduce((total, entry) => total + entry.minutes, 0);

  const rangesForDay = (unitId: string, dayOfWeek: number): IndexedRange[] =>
    (rangesByUnit.get(unitId) ?? []).filter((range) => range.item.day_of_week === dayOfWeek);

  const isRangeInvalid = (item: PractitionerAvailabilityItem): boolean =>
    timeToMinutes(item.end_time) <= timeToMinutes(item.start_time);

  const dayIssues = (unitId: string, dayOfWeek: number): string[] => {
    const issues = new Set<string>();
    const seen = new Set<string>();
    rangesForDay(unitId, dayOfWeek).forEach(({ item }) => {
      if (isRangeInvalid(item)) {
        issues.add(t('PRACTITIONER_UNITS_ERROR_TIME_ORDER'));
        return;
      }
      const key = `${item.start_time}-${item.end_time}`;
      if (seen.has(key)) issues.add(t('PRACTITIONER_UNITS_ERROR_DUPLICATE'));
      seen.add(key);
    });
    return Array.from(issues);
  };

  const linkUnit = (unitId: string) => {
    onChange([
      ...availability,
      {
        organization_unit_id: unitId,
        day_of_week: DAYS_OF_WEEK[0].id,
        start_time: DEFAULT_START_TIME,
        end_time: DEFAULT_END_TIME,
        slot_duration_minutes: DEFAULT_SLOT_DURATION,
      },
    ]);
    setSelectedUnitId(unitId);
  };

  const unlinkUnit = (unitId: string) => {
    onChange(availability.filter((item) => item.organization_unit_id !== unitId));
    setUnlinkConfirmingId(null);
    if (selectedUnitId === unitId) setSelectedUnitId(null);
  };

  const addRange = (unitId: string, dayOfWeek: number) => {
    // Continue the day from the end of its last shift; fall back to the default
    // window when the day is still empty or has no room left.
    const dayRanges = rangesForDay(unitId, dayOfWeek);
    const lastEnd = dayRanges.reduce((latest, range) => Math.max(latest, timeToMinutes(range.item.end_time)), 0);
    const continuesDay = lastEnd > 0 && lastEnd < LAST_MINUTE_OF_DAY - 30;
    const duration = rangesByUnit.get(unitId)?.[0]?.item.slot_duration_minutes ?? DEFAULT_SLOT_DURATION;

    onChange([
      ...availability,
      {
        organization_unit_id: unitId,
        day_of_week: dayOfWeek,
        start_time: continuesDay ? minutesToTime(lastEnd) : DEFAULT_START_TIME,
        end_time: continuesDay ? minutesToTime(lastEnd + DEFAULT_SHIFT_MINUTES) : DEFAULT_END_TIME,
        slot_duration_minutes: duration,
      },
    ]);
  };

  const patchRange = (index: number, patch: Partial<PractitionerAvailabilityItem>) => {
    onChange(availability.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeRange = (index: number) => {
    onChange(availability.filter((_, i) => i !== index));
  };

  const applyUnitDuration = (unitId: string, minutes: number) => {
    onChange(
      availability.map((item) =>
        item.organization_unit_id === unitId ? { ...item, slot_duration_minutes: minutes } : item
      )
    );
  };

  const sectionLabelStyle: React.CSSProperties = {
    padding: '4px 14px',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: '#94a3b8',
  };

  const showEmptyCatalog = !unitsLoading && !unitsError && activeUnits.length === 0;

  return (
    // Two columns: the unit catalog with the schedule summary stacked under it on the left,
    // and the shift editor spanning both rows on the right. The left column is fixed so the
    // summary starts right below the catalog instead of hanging off the taller neighbour.
    <div
      style={{
        display: 'grid',
        // 380px is the widest the left column can get while the editor still fits two
        // shifts per day row: 1050 available - 380 - 16 gap = 654 for the editor, whose
        // day row spends 146 fixed (day label + add button) plus 34 chrome, leaving 474
        // for chips that are 216 wide each (440 for two, including the gap between them).
        gridTemplateColumns: '380px 1fr',
        gridTemplateRows: 'auto 1fr',
        gap: 16,
        alignItems: 'start',
        minHeight: 400,
      }}
    >
      {/* ── Left top: organization units ── */}
      <div style={{ ...panelStyle, gridColumn: 1, gridRow: 1, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
            {t('PRACTITIONER_UNITS_TITLE')}
          </div>
          <div style={{ fontSize: '0.70rem', color: '#64748b' }}>{t('PRACTITIONER_UNITS_SUBTITLE')}</div>
        </div>

        {unitsLoading && <div style={panelMessageStyle}>{t('PRACTITIONER_UNITS_LOADING')}</div>}

        {!unitsLoading && unitsError && (
          <div style={{ ...panelMessageStyle, color: '#dc2626' }}>{t('PRACTITIONER_UNITS_ERROR_LOAD')}</div>
        )}

        {showEmptyCatalog && (
          <div style={panelMessageStyle}>
            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
              {t('PRACTITIONER_UNITS_NO_UNITS')}
            </div>
            {t('PRACTITIONER_UNITS_NO_UNITS_HINT')}
          </div>
        )}

        {!unitsLoading && !unitsError && linkedUnits.length > 0 && (
          <div style={{ padding: '8px 0' }}>
            <div style={sectionLabelStyle}>{t('PRACTITIONER_UNITS_LINKED_SECTION')}</div>
            {linkedUnits.map((unit) => {
              const isSelected = unit.id === selectedUnitId;
              const count = rangesByUnit.get(unit.id)?.length ?? 0;
              return (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => setSelectedUnitId(unit.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 14px',
                    border: 'none',
                    borderLeft: isSelected ? '3px solid #0284c7' : '3px solid transparent',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{ width: 7, height: 7, borderRadius: '50%', background: '#0284c7', flexShrink: 0 }}
                  />
                  <span
                    title={unit.name}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#0284c7' : '#334155',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {unit.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      color: isSelected ? '#0284c7' : '#94a3b8',
                      flexShrink: 0,
                    }}
                  >
                    {count === 1
                      ? t('PRACTITIONER_UNITS_RANGE_ONE')
                      : t('PRACTITIONER_UNITS_RANGE_MANY', { count })}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!unitsLoading && !unitsError && activeUnits.length > 0 && (
          <div style={{ borderTop: '1px solid #e2e8f0', padding: '8px 0' }}>
            <div style={sectionLabelStyle}>{t('PRACTITIONER_UNITS_AVAILABLE_SECTION')}</div>
            {availableUnits.length === 0 ? (
              <div style={{ ...panelMessageStyle, padding: '2px 14px 6px' }}>
                {t('PRACTITIONER_UNITS_ALL_LINKED')}
              </div>
            ) : (
              availableUnits.map((unit) => (
                <div
                  key={unit.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px' }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      border: '1px solid #cbd5e1',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    title={unit.name}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '0.78rem',
                      color: '#475569',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {unit.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => linkUnit(unit.id)}
                    title={t('PRACTITIONER_UNITS_LINK')}
                    style={{
                      flexShrink: 0,
                      height: 24,
                      padding: '0 8px',
                      borderRadius: 6,
                      border: '1px solid #bae6fd',
                      background: '#f0f9ff',
                      color: '#0284c7',
                      fontSize: '0.70rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + {t('PRACTITIONER_UNITS_LINK')}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Right: weekly schedule of the selected unit, spanning both left rows ── */}
      <div style={{ ...panelStyle, gridColumn: 2, gridRow: '1 / 3', minWidth: 0, overflow: 'hidden' }}>
        {!selectedUnit ? (
          <div
            style={{
              padding: '56px 24px',
              textAlign: 'center',
              fontSize: '0.80rem',
              lineHeight: 1.5,
              color: '#64748b',
            }}
          >
            {t('PRACTITIONER_UNITS_SELECT_PROMPT')}
          </div>
        ) : (
          <>
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedUnit.name}
                  </span>
                  {selectedUnit.isHeadquarters && (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: '#e0f2fe',
                        border: '1px solid #bae6fd',
                        color: '#0284c7',
                        fontSize: '0.64rem',
                        fontWeight: 700,
                      }}
                    >
                      {t('PRACTITIONER_UNITS_HQ')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.70rem', color: '#64748b' }}>
                  {t('PRACTITIONER_UNITS_CNES')}: {selectedUnit.cnesCode || '—'}
                </div>
              </div>

              {unlinkConfirmingId === selectedUnit.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>
                    {t('PRACTITIONER_UNITS_UNLINK_CONFIRM')}
                  </span>
                  <button
                    type="button"
                    onClick={() => unlinkUnit(selectedUnit.id)}
                    style={{
                      height: 28,
                      padding: '0 10px',
                      borderRadius: 6,
                      border: '1px solid #fecaca',
                      background: '#fee2e2',
                      color: '#dc2626',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {t('GLOBAL_BTN_CONFIRM')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnlinkConfirmingId(null)}
                    style={{
                      height: 28,
                      padding: '0 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t('GLOBAL_BTN_CANCEL')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setUnlinkConfirmingId(selectedUnit.id)}
                  style={{
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#64748b',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('PRACTITIONER_UNITS_UNLINK')}
                </button>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                borderBottom: '1px solid #e2e8f0',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155' }}>
                {t('FIELD_LABEL_SLOT_DURATION')}
              </span>
              <select
                value={unitDuration}
                onChange={(e) => applyUnitDuration(selectedUnit.id, Number(e.target.value))}
                style={{
                  height: 30,
                  padding: '0 8px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '0.78rem',
                  boxSizing: 'border-box',
                }}
              >
                {SLOT_DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {t('FIELD_SLOT_DURATION_MINUTES', { minutes })}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '0.70rem', color: '#94a3b8' }}>
                {t('PRACTITIONER_UNITS_DURATION_HINT')}
              </span>
            </div>

            <div style={{ padding: '4px 16px 14px' }}>
              {DAYS_OF_WEEK.map((day, dayPosition) => {
                const dayRanges = rangesForDay(selectedUnit.id, day.id);
                const issues = dayIssues(selectedUnit.id, day.id);
                return (
                  <div
                    key={day.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '96px 1fr 30px',
                      alignItems: 'start',
                      gap: 10,
                      padding: '9px 0',
                      borderTop: dayPosition === 0 ? 'none' : '1px solid #f1f5f9',
                    }}
                  >
                    <div
                      style={{
                        paddingTop: 7,
                        fontSize: '0.78rem',
                        fontWeight: dayRanges.length > 0 ? 700 : 500,
                        color: dayRanges.length > 0 ? '#0f172a' : '#94a3b8',
                      }}
                    >
                      {t(day.labelKey)}
                    </div>

                    {/* Shifts are intrinsic-width chips so two fit per row; a third (or a
                        narrower viewport) wraps to the next line. */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      {dayRanges.length === 0 ? (
                        <span style={{ paddingTop: 7, fontSize: '0.75rem', color: '#94a3b8' }}>
                          {t('PRACTITIONER_UNITS_NO_RANGES')}
                        </span>
                      ) : (
                        dayRanges.map(({ item, index }) => (
                          <div
                            key={index}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 4px',
                              borderRadius: 8,
                              border: `1px solid ${isRangeInvalid(item) ? '#fecaca' : '#e2e8f0'}`,
                              background: isRangeInvalid(item) ? '#fef2f2' : '#ffffff',
                            }}
                          >
                            <input
                              type="time"
                              value={item.start_time}
                              onChange={(e) => patchRange(index, { start_time: e.target.value })}
                              title={t('FIELD_LABEL_START_TIME')}
                              aria-label={t('FIELD_LABEL_START_TIME')}
                              style={timeInputStyle}
                            />
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>–</span>
                            <input
                              type="time"
                              value={item.end_time}
                              onChange={(e) => patchRange(index, { end_time: e.target.value })}
                              title={t('FIELD_LABEL_END_TIME')}
                              aria-label={t('FIELD_LABEL_END_TIME')}
                              style={timeInputStyle}
                            />
                            <button
                              type="button"
                              onClick={() => removeRange(index)}
                              title={t('PRACTITIONER_UNITS_REMOVE_RANGE')}
                              aria-label={t('PRACTITIONER_UNITS_REMOVE_RANGE')}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 6,
                                border: 'none',
                                background: 'transparent',
                                color: '#cbd5e1',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}

                      {issues.length > 0 && (
                        <div style={{ flexBasis: '100%', fontSize: '0.68rem', color: '#dc2626' }}>
                          {issues.join(' ')}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => addRange(selectedUnit.id, day.id)}
                      title={t('PRACTITIONER_UNITS_ADD_TO_DAY')}
                      aria-label={t('PRACTITIONER_UNITS_ADD_TO_DAY')}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: '1px dashed #cbd5e1',
                        background: '#ffffff',
                        color: '#0284c7',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        lineHeight: 1,
                        cursor: 'pointer',
                      }}
                    >
                      +
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Left bottom: every shift assigned to the practitioner ── */}
      {summary.length > 0 && (
        <div style={{ ...panelStyle, gridColumn: 1, gridRow: 2, minWidth: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
              {t('PRACTITIONER_UNITS_SUMMARY_TITLE')}
            </div>
            <div style={{ fontSize: '0.70rem', color: '#64748b' }}>
              {t('PRACTITIONER_UNITS_SUMMARY_TOTALS', {
                units: summary.length,
                ranges: totalRanges,
                hours: formatHours(totalMinutes),
              })}
            </div>
          </div>

          {summary.map(({ unit, rangeCount, minutes, days }) => {
            const isSelected = unit.id === selectedUnitId;
            return (
              <div
                key={unit.id}
                style={{
                  borderTop: '1px solid #f1f5f9',
                  borderLeft: isSelected ? '3px solid #0284c7' : '3px solid transparent',
                  background: isSelected ? '#eff6ff' : 'transparent',
                }}
              >
                {/* Clicking a line selects that unit in the editor above. */}
                <button
                  type="button"
                  onClick={() => setSelectedUnitId(unit.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px 3px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    title={unit.name}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: isSelected ? '#0284c7' : '#0f172a',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {unit.name}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: '0.68rem', color: '#64748b' }}>
                    {rangeCount === 1
                      ? t('PRACTITIONER_UNITS_RANGE_ONE')
                      : t('PRACTITIONER_UNITS_RANGE_MANY', { count: rangeCount })}
                    {' · '}
                    {t('PRACTITIONER_UNITS_SUMMARY_HOURS', { hours: formatHours(minutes) })}
                  </span>
                </button>

                <div style={{ padding: '0 16px 9px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {days.map((day) => (
                    <div key={day.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span
                        style={{ width: 32, flexShrink: 0, fontSize: '0.70rem', fontWeight: 700, color: '#94a3b8' }}
                      >
                        {t(day.shortKey)}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#334155', fontFamily: 'monospace' }}>
                        {day.ranges
                          .map((range) => `${range.item.start_time}–${range.item.end_time}`)
                          .join('   ·   ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
