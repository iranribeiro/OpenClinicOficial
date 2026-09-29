import postgres from 'postgres';
import type { DatabaseOptions } from '../utils/database-connection.js';
import { resolveDbCheckTargets } from '../utils/db-check-targets.js';

export interface DbCheckOptions extends DatabaseOptions {
  role?: 'app' | 'owner' | 'all';
}

interface ConnectionDiagnostic {
  roleName: string;
  configuredUser: string;
  targetIdentity: string;
  connectedDatabase: string;
  connectedUser: string;
  serverVersion: string;
  serverTime: string;
  databaseSize: string;
  tableCount: number;
  appliedMigrations: number | string;
  latencyMs: number;
  status: 'CONNECTED' | 'FAILED';
  error?: string;
}

async function inspectConnection(
  roleName: 'App (DML)' | 'Owner (DDL)',
  connectionUrl: string,
  configuredUser: string
): Promise<ConnectionDiagnostic> {
  const parsed = new URL(connectionUrl);
  const targetIdentity = `${parsed.hostname}:${parsed.port || '5432'}/${parsed.pathname.replace(/^\//, '')}`;

  const start = performance.now();
  const sql = postgres(connectionUrl, {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 1,
  });

  try {
    const [meta] = await sql`
      SELECT
        current_database() AS current_database,
        current_user AS current_user,
        version() AS server_version,
        NOW() AS server_time,
        pg_size_pretty(pg_database_size(current_database())) AS database_size
    `;

    const [tableInfo] = await sql`
      SELECT count(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;

    let migrationsCount: number | string = 'N/A';
    try {
      const [migrationInfo] = await sql`
        SELECT count(*)::int AS count
        FROM drizzle.__drizzle_migrations
      `;
      migrationsCount = migrationInfo?.count ?? 0;
    } catch {
      migrationsCount = 'unavailable';
    }

    const latencyMs = Math.round(performance.now() - start);

    return {
      roleName,
      configuredUser,
      targetIdentity,
      connectedDatabase: String(meta?.current_database ?? 'unknown'),
      connectedUser: String(meta?.current_user ?? 'unknown'),
      serverVersion: String(meta?.server_version ?? 'unknown').split(' on ')[0] ?? 'PostgreSQL',
      serverTime: new Date(meta?.server_time).toISOString(),
      databaseSize: String(meta?.database_size ?? 'unknown'),
      tableCount: Number(tableInfo?.count ?? 0),
      appliedMigrations: migrationsCount,
      latencyMs,
      status: 'CONNECTED',
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      roleName,
      configuredUser,
      targetIdentity,
      connectedDatabase: 'unknown',
      connectedUser: 'unknown',
      serverVersion: 'unknown',
      serverTime: 'unknown',
      databaseSize: 'unknown',
      tableCount: 0,
      appliedMigrations: 'unknown',
      latencyMs,
      status: 'FAILED',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await sql.end().catch(() => {});
  }
}

export async function dbCheck(options: DbCheckOptions = {}): Promise<void> {
  const target = (options.target ?? 'local').toLowerCase().trim();
  const destinations = resolveDbCheckTargets(options);

  console.log(`\n🔍 Verifying Database Connectivity (${target.toUpperCase()} environment)...`);

  const diagnostics: ConnectionDiagnostic[] = [];
  let hasFailure = false;

  for (const destination of destinations) {
    const diag = await inspectConnection(
      destination.role === 'app' ? 'App (DML)' : 'Owner (DDL)',
      destination.url,
      destination.username,
    );
    diagnostics.push(diag);
    if (diag.status === 'FAILED') hasFailure = true;
  }

  if (diagnostics.length === 0) {
    console.error('\n❌ [FAIL] No database connection credentials found for the specified target.');
    process.exit(1);
  }

  console.log('\n--- Database Connection Diagnostics ---');
  console.table(
    diagnostics.map((d) => ({
      Role: d.roleName,
      Status: d.status,
      Database: d.connectedDatabase,
      Identity: d.targetIdentity,
      User: d.connectedUser,
      Tables: d.tableCount,
      Migrations: d.appliedMigrations,
      Latency: `${d.latencyMs}ms`,
    }))
  );

  for (const d of diagnostics) {
    if (d.status === 'CONNECTED') {
      console.log(`\n✔ [OK] ${d.roleName}: successfully connected to "${d.connectedDatabase}" at "${d.targetIdentity}"`);
      console.log(`   - PostgreSQL Version: ${d.serverVersion}`);
      console.log(`   - Database Size: ${d.databaseSize}`);
      console.log(`   - Server Time: ${d.serverTime}`);
    } else {
      console.error(`\n❌ [FAIL] ${d.roleName}: connection failed to "${d.targetIdentity}"`);
      console.error(`   - Error: ${d.error}`);
    }
  }

  if (hasFailure) {
    console.error('\n❌ Database validation failed.');
    process.exit(1);
  } else {
    console.log('\n✅ Database validation completed successfully!');
  }
}
