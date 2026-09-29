-- ==============================================================================
-- OpenClinic DB Migration: 0008_standardize_resource_codes_and_routes.sql
-- Description: Standardize sys_application_resources to Option A (<section>_<item>),
--              reorder Platform section, remove base_shifts, and update routes.
-- ==============================================================================

-- 1. Remove obsolete base_shifts resource and its ACL permissions
DELETE FROM "iam_permissions"
WHERE "resource_id" IN (
  SELECT "id" FROM "sys_application_resources" WHERE "item_code" = 'base_shifts'
);

DELETE FROM "sys_application_resources"
WHERE "item_code" = 'base_shifts';

-- 2. Section: attendance
UPDATE "sys_application_resources"
SET "item_code" = 'attendance_schedule',
    "route" = '/attendance/schedule',
    "sort_order" = 10,
    "updated_at" = now()
WHERE "item_code" IN ('op_schedule', 'attendance_schedule');

UPDATE "sys_application_resources"
SET "item_code" = 'attendance_queue',
    "route" = '/attendance/queue',
    "sort_order" = 20,
    "updated_at" = now()
WHERE "item_code" IN ('op_attendance', 'attendance_queue');

-- 3. Section: clinical
UPDATE "sys_application_resources"
SET "item_code" = 'clinical_patients',
    "route" = '/clinical/patients',
    "sort_order" = 30,
    "updated_at" = now()
WHERE "item_code" IN ('op_patients', 'clinical_patients');

UPDATE "sys_application_resources"
SET "item_code" = 'clinical_consultations',
    "route" = '/clinical/consultations',
    "sort_order" = 40,
    "updated_at" = now()
WHERE "item_code" IN ('op_consultations', 'clinical_consultations');

UPDATE "sys_application_resources"
SET "item_code" = 'clinical_records',
    "route" = '/clinical/records',
    "sort_order" = 50,
    "updated_at" = now()
WHERE "item_code" IN ('op_pep', 'clinical_records');

-- 4. Section: financial
UPDATE "sys_application_resources"
SET "item_code" = 'financial_billing',
    "route" = '/financial/billing',
    "sort_order" = 60,
    "updated_at" = now()
WHERE "item_code" IN ('op_billing', 'financial_billing');

UPDATE "sys_application_resources"
SET "item_code" = 'financial_cashflow',
    "route" = '/financial/cash-flow',
    "sort_order" = 70,
    "updated_at" = now()
WHERE "item_code" IN ('op_cashflow', 'financial_cashflow');

UPDATE "sys_application_resources"
SET "item_code" = 'financial_payables',
    "route" = '/financial/payables',
    "sort_order" = 80,
    "updated_at" = now()
WHERE "item_code" IN ('op_payables', 'financial_payables');

-- 5. Section: registries
UPDATE "sys_application_resources"
SET "item_code" = 'registries_organizations',
    "context" = 'BUSINESS',
    "label_key" = 'NAV_BASE_ORGANIZATIONS',
    "route" = '/registries/organizations',
    "sort_order" = 85,
    "updated_at" = now()
WHERE "item_code" IN ('base_organizations', 'menu_sys_institution', 'registries_organizations');

UPDATE "sys_application_resources"
SET "item_code" = 'registries_practitioners',
    "route" = '/registries/practitioners',
    "sort_order" = 90,
    "updated_at" = now()
WHERE "item_code" IN ('base_practitioners', 'registries_practitioners');

UPDATE "sys_application_resources"
SET "item_code" = 'registries_staff',
    "route" = '/registries/staff',
    "sort_order" = 95,
    "updated_at" = now()
WHERE "item_code" IN ('base_staff', 'registries_staff');

UPDATE "sys_application_resources"
SET "item_code" = 'registries_health_plans',
    "route" = '/registries/health-plans',
    "sort_order" = 100,
    "updated_at" = now()
WHERE "item_code" IN ('base_health_plans', 'registries_health_plans');

UPDATE "sys_application_resources"
SET "item_code" = 'registries_procedures',
    "route" = '/registries/procedures',
    "sort_order" = 110,
    "updated_at" = now()
WHERE "item_code" IN ('base_procedures', 'registries_procedures');

-- 6. Section: management
UPDATE "sys_application_resources"
SET "item_code" = 'management_metrics',
    "route" = '/management/metrics',
    "sort_order" = 120,
    "updated_at" = now()
WHERE "item_code" IN ('menu_mgmt_indicators', 'management_metrics');

UPDATE "sys_application_resources"
SET "item_code" = 'management_reports',
    "route" = '/management/reports',
    "sort_order" = 130,
    "updated_at" = now()
WHERE "item_code" IN ('menu_mgmt_reports', 'management_reports');

-- 7. Section: system
UPDATE "sys_application_resources"
SET "item_code" = 'system_users',
    "route" = '/system/users',
    "sort_order" = 210,
    "updated_at" = now()
WHERE "item_code" IN ('menu_sys_users', 'system_users');

UPDATE "sys_application_resources"
SET "item_code" = 'system_settings',
    "route" = '/system/settings',
    "sort_order" = 220,
    "updated_at" = now()
WHERE "item_code" IN ('menu_sys_settings', 'system_settings');

UPDATE "sys_application_resources"
SET "item_code" = 'system_audit',
    "route" = '/system/audit',
    "sort_order" = 230,
    "updated_at" = now()
WHERE "item_code" IN ('menu_sys_audit', 'system_audit');

-- 8. Section: platform (Exclusive to OWNER)
UPDATE "sys_application_resources"
SET "item_code" = 'platform_tenants',
    "route" = '/platform/tenants',
    "sort_order" = 300,
    "updated_at" = now()
WHERE "item_code" IN ('menu_platform_tenants', 'platform_tenants');

UPDATE "sys_application_resources"
SET "item_code" = 'platform_settings',
    "route" = '/platform/settings',
    "sort_order" = 310,
    "label_key" = 'NAV_PLATFORM_SETTINGS',
    "updated_at" = now()
WHERE "item_code" IN ('menu_platform_settings', 'platform_settings');

UPDATE "sys_application_resources"
SET "item_code" = 'platform_api_keys',
    "route" = '/platform/api-keys',
    "sort_order" = 320,
    "updated_at" = now()
WHERE "item_code" IN ('menu_platform_api_keys', 'platform_api_keys');

UPDATE "sys_application_resources"
SET "item_code" = 'platform_integrations',
    "route" = '/platform/integrations',
    "sort_order" = 330,
    "label_key" = 'NAV_PLATFORM_WEBHOOKS',
    "updated_at" = now()
WHERE "item_code" IN ('menu_platform_webhooks', 'platform_integrations');

UPDATE "sys_application_resources"
SET "item_code" = 'platform_policies',
    "route" = '/platform/policies',
    "sort_order" = 340,
    "updated_at" = now()
WHERE "item_code" IN ('menu_platform_policies', 'platform_policies');

-- 9. Section: account
UPDATE "sys_application_resources"
SET "item_code" = 'account_profile',
    "route" = '/account/profile',
    "sort_order" = 400,
    "updated_at" = now()
WHERE "item_code" IN ('menu_profile', 'account_profile');

UPDATE "sys_application_resources"
SET "item_code" = 'account_security',
    "route" = '/account/security',
    "sort_order" = 410,
    "updated_at" = now()
WHERE "item_code" IN ('menu_password', 'account_security');

UPDATE "sys_application_resources"
SET "item_code" = 'account_help',
    "route" = '/account/help',
    "sort_order" = 420,
    "updated_at" = now()
WHERE "item_code" IN ('menu_help', 'account_help');
