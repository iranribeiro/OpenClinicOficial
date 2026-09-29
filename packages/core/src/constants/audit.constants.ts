/**
 * Canonical audit trail constants and default operator identifiers.
 * Harmonized with the UserRole hierarchy: OWNER, ADMIN, USER.
 */
export const AUDIT_CONSTANTS = {
  SYSTEM_OPERATOR: 'system',
  ANONYMOUS_OPERATOR: 'anonymous',
} as const;

export type AuditConstants = typeof AUDIT_CONSTANTS;
