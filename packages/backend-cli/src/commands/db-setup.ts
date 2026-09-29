import postgres from 'postgres';
import { dbMigrate } from './db-migrate.js';
import { dbSeed } from './db-seed.js';
import { authCheck } from './auth-check.js';
import { ensureDefaultSuperAdmin } from './user-create-admin.js';
import { BOOTSTRAP_DEFAULTS, DEFAULT_PLATFORM_MANIFEST, Cpf } from '@openclinic/core';
import { getDatabaseConfig, type DatabaseConfig } from '../utils/database-connection.js';

const PG_DEFAULT_MAINTENANCE_DB = 'postgres';
const PG_DEFAULT_SUPERUSER = 'postgres';
const MAINTENANCE_CONNECT_TIMEOUT_SECONDS = 5;
const DEV_DASHBOARD_URL = 'http://localhost:5173 (Dev) or http://localhost (Docker)';
const DEFAULT_OWNER_ROLE_SUFFIX = '_owner';
const DEFAULT_APP_ROLE_SUFFIX = '_app';

function validateIdentifier(name: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Invalid PostgreSQL identifier: "${name}"`);
  }
  return name;
}

async function ensureTargetDatabaseExists(config: DatabaseConfig): Promise<void> {
  const targetDb = config.database;
  if (!targetDb || targetDb === PG_DEFAULT_MAINTENANCE_DB) return;

  const candidates: Array<{ username?: string; password?: string }> = [
    { username: config.ownerUser, password: config.ownerPassword },
    { username: PG_DEFAULT_SUPERUSER, password: process.env['POSTGRES_PASSWORD'] },
    { username: config.appUser, password: config.appPassword },
  ].filter(c => Boolean(c.username));

  for (const creds of candidates) {
    if (!creds.username) continue;
    let maintenanceSql: postgres.Sql | null = null;
    try {
      maintenanceSql = postgres({
        host: config.host,
        port: config.port,
        database: PG_DEFAULT_MAINTENANCE_DB,
        username: creds.username,
        password: creds.password,
        connect_timeout: MAINTENANCE_CONNECT_TIMEOUT_SECONDS,
        max: 1,
      });

      const [db] = await maintenanceSql`
        SELECT 1 FROM pg_database WHERE datname = ${targetDb}
      `;

      if (!db) {
        console.log(`Target database "${targetDb}" does not exist. Creating dynamically...`);
        const ownerRole = validateIdentifier(
          config.ownerUser || `${targetDb}${DEFAULT_OWNER_ROLE_SUFFIX}`
        );
        const safeDbName = validateIdentifier(targetDb);
        await maintenanceSql.unsafe(`CREATE DATABASE "${safeDbName}" OWNER "${ownerRole}";`);

        const appRole = config.appUser || `${targetDb}${DEFAULT_APP_ROLE_SUFFIX}`;
        if (appRole && appRole !== ownerRole) {
          const safeAppRole = validateIdentifier(appRole);
          await maintenanceSql.unsafe(`GRANT ALL PRIVILEGES ON DATABASE "${safeDbName}" TO "${safeAppRole}";`);
        }
        console.log(`✔ Database "${safeDbName}" created with owner "${ownerRole}".\n`);
      }
      return;
    } catch {
      // Try next credential candidate
    } finally {
      if (maintenanceSql) {
        await maintenanceSql.end().catch(() => {});
      }
    }
  }
}

async function ensureAppTablePrivileges(config: DatabaseConfig): Promise<void> {
  const targetDb = config.database;
  const ownerRole = config.ownerUser || `${targetDb}${DEFAULT_OWNER_ROLE_SUFFIX}`;
  const appRole = config.appUser || `${targetDb}${DEFAULT_APP_ROLE_SUFFIX}`;
  if (!appRole || appRole === ownerRole) return;

  let ownerSql: postgres.Sql | null = null;
  try {
    const safeOwnerRole = validateIdentifier(ownerRole);
    const safeAppRole = validateIdentifier(appRole);

    ownerSql = postgres({
      host: config.host,
      port: config.port,
      database: targetDb,
      username: config.ownerUser,
      password: config.ownerPassword,
      connect_timeout: MAINTENANCE_CONNECT_TIMEOUT_SECONDS,
      max: 1,
    });

    await ownerSql.unsafe(`
      GRANT USAGE, CREATE ON SCHEMA public TO "${safeAppRole}";
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${safeAppRole}";
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${safeAppRole}";
      ALTER DEFAULT PRIVILEGES FOR ROLE "${safeOwnerRole}" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${safeAppRole}";
      ALTER DEFAULT PRIVILEGES FOR ROLE "${safeOwnerRole}" IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "${safeAppRole}";
    `);
  } catch {
    // Non-blocking fallback
  } finally {
    if (ownerSql) {
      await ownerSql.end().catch(() => {});
    }
  }
}

export async function dbSetup(options: { demo?: boolean } = {}): Promise<void> {
  const config = getDatabaseConfig();
  const targetDb = config.database || DEFAULT_PLATFORM_MANIFEST.CODE;

  console.log('============================================================');
  console.log(`  Automated Local Database Provisioning [${targetDb}]`);
  console.log('  (Cross-platform Execution: Node.js / TypeScript)          ');
  console.log('============================================================\n');

  try {
    await ensureTargetDatabaseExists(config);

    console.log('[1/3] Applying migrations and reference catalog...');
    await dbMigrate();
    await ensureAppTablePrivileges(config);

    if (options.demo) {
      console.log('Loading full demonstration catalog...');
      await dbSeed({ demo: true });
    } else {
      console.log('Ensuring initial superadministrator (OWNER role)...');
      const superAdminResult = await ensureDefaultSuperAdmin();
      const formattedCpf = Cpf.format(BOOTSTRAP_DEFAULTS.DEFAULT_OWNER_CPF);
      if (superAdminResult.created) {
        console.log(`  -> Superadministrator created successfully: ${superAdminResult.username} (CPF: ${formattedCpf}, role: OWNER)`);
      } else {
        console.log(`  -> Superadministrator verified: ${superAdminResult.username} (CPF: ${formattedCpf}, role: OWNER)`);
      }
    }

    console.log('\n[2/3] Validating hashing integrity and JWT signing...');
    await authCheck();

    console.log('\n[3/3] Credentials and Access Summary:');
    console.log('  Role:        OWNER (Superadministrator)');
    console.log(`  Username:    ${BOOTSTRAP_DEFAULTS.DEFAULT_OWNER_USERNAME}`);
    console.log(`  CPF:         ${Cpf.format(BOOTSTRAP_DEFAULTS.DEFAULT_OWNER_CPF)} (or ${BOOTSTRAP_DEFAULTS.DEFAULT_OWNER_CPF})`);
    console.log(`  Password:    ${BOOTSTRAP_DEFAULTS.DEFAULT_OWNER_PASSWORD}`);
    console.log(`  Dashboard:   ${DEV_DASHBOARD_URL}`);

    console.log('\n============================================================');
    console.log('  Database provisioned and configured successfully!         ');
    console.log('============================================================\n');
    console.log('To start the development environment:');
    console.log('  Terminal 1: npm run dev:api');
    console.log('  Terminal 2: npm run dev:webapp\n');
  } catch (error) {
    console.error('\n❌ [CRITICAL ERROR] Failed to provision database:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
