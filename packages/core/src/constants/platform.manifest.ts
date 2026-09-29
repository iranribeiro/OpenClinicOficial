import { SupportedLocales } from '../domain/locales.js';
import { LoginMethod } from '../domain/enums.js';
import { CountryCode, COUNTRY_METADATA } from '../domain/value-objects/country.vo.js';

/**
 * Canonical platform metadata, product identification, and fallback constants.
 * Single Source of Truth for system identity, branding seeds, and unauthenticated client fallback.
 */
export const DEFAULT_PLATFORM_MANIFEST = {
  CODE: 'openclinic',
  PRODUCT_NAME: 'OpenClinic',
  DEFAULT_APP_NAME: 'OpenClinic',
  DEFAULT_APP_SUBTITLE: 'Open Source Electronic Health Record (EHR)',
  DEFAULT_APP_DESCRIPTION: 'Open source electronic health record and clinical practice management platform.',
  DEFAULT_APP_VERSION: '0.1.1',
  DEFAULT_APP_LOGO_URL: '/logo.png',
  DEFAULT_APP_FAVICON_URL: '/favicon.png',
  DEFAULT_TENANT_NAME: 'OpenClinic System',
  DEFAULT_TENANT_SLUG: 'openclinic-system',
  DEFAULT_GROUP_NAME: 'All Users',
  DEFAULT_LOCALE: SupportedLocales.PT_BR,
  SUPPORTED_LOCALES: [SupportedLocales.PT_BR, SupportedLocales.EN_US],
  DEFAULT_TIMEZONE: 'America/Sao_Paulo',
  DEFAULT_COUNTRY: CountryCode.BRAZIL,
  DEFAULT_DIALING_CODE: COUNTRY_METADATA[CountryCode.BRAZIL].ddi,
  ACCEPTED_LOGIN_METHODS: [LoginMethod.PASSWORD],
  ALLOW_DIRECT_USER_CREATION: true,
  POWERED_BY_PREFIX: 'Powered by',
} as const;

export type PlatformManifest = typeof DEFAULT_PLATFORM_MANIFEST;
