import { DEFAULT_PLATFORM_MANIFEST } from './platform.manifest.js';

/**
 * Canonical bootstrap and seed default credentials and metadata.
 * Harmonized with the UserRole hierarchy: OWNER.
 * Note: DEFAULT_OWNER_PASSWORD is strictly for local development and demo seeding,
 * and MUST NEVER be accepted when secureBootstrap / production mode is enabled.
 */
export const BOOTSTRAP_DEFAULTS = {
  DEV_DEFAULT_PASSWORD: 'temp1234',

  // Default Initial Owner (UserRole.OWNER) for Local Development / First Setup
  DEFAULT_OWNER_USERNAME: 'superadministrator',
  DEFAULT_OWNER_EMAIL: 'superadministrator@example.com',
  DEFAULT_OWNER_CPF: '12345678909',
  DEFAULT_OWNER_CPF_FORMATTED: '123.456.789-09',
  DEFAULT_OWNER_PASSWORD: 'temp1234',
  DEFAULT_OWNER_FULL_NAME: 'Superadministrator',
  DEFAULT_OWNER_JOB_TITLE: 'Platform Superadministrator',

  // System Organization & Group Defaults (derived from canonical DEFAULT_PLATFORM_MANIFEST)
  DEFAULT_GROUP_NAME: DEFAULT_PLATFORM_MANIFEST.DEFAULT_GROUP_NAME,
  DEFAULT_SYSTEM_TENANT_NAME: DEFAULT_PLATFORM_MANIFEST.DEFAULT_TENANT_NAME,
  DEFAULT_SYSTEM_TENANT_SLUG: DEFAULT_PLATFORM_MANIFEST.DEFAULT_TENANT_SLUG,
  DEFAULT_COUNTRY: DEFAULT_PLATFORM_MANIFEST.DEFAULT_COUNTRY,
  DEFAULT_DIALING_CODE: DEFAULT_PLATFORM_MANIFEST.DEFAULT_DIALING_CODE,
} as const;

export type BootstrapDefaults = typeof BOOTSTRAP_DEFAULTS;

