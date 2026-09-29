import path from 'node:path';
import { createSecretProvider, FileSecretProvider, parseDatabaseSecret } from '@openclinic/core/server';

export interface DbCheckTargetOptions {
  target?: string;
  role?: string;
}

const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'db', 'postgres', 'openclinic-db', 'host.docker.internal']);

/** Resolve every requested role before opening connections; never use inline credentials. */
export function resolveDbCheckTargets(
  options: DbCheckTargetOptions,
  environment: Record<string, string | undefined> = process.env,
) {
  const target = (options.target ?? 'local').trim().toLowerCase();
  const role = (options.role ?? 'all').trim().toLowerCase();
  if (!['local', 'remote'].includes(target)) throw new Error('Invalid target. Use local or remote.');
  if (!['app', 'owner', 'all'].includes(role)) throw new Error('Invalid role. Use app, owner or all.');
  const provider = createSecretProvider(environment);
  return (role === 'all' ? ['app', 'owner'] : [role]).map(selectedRole => {
    const prefix = target === 'remote' ? 'REMOTE_' : '';
    const nameKey = `${prefix}DB_${selectedRole.toUpperCase()}_SECRET_NAME`;
    const fileKey = `${prefix}DATABASE_${selectedRole === 'owner' ? 'OWNER_' : ''}URL_FILE`;
    const configuredName = environment[nameKey];
    const configuredFile = environment[fileKey];
    if (configuredFile !== undefined && !configuredFile.trim()) throw new Error(`${fileKey} must specify a file.`);
    if (configuredName !== undefined && !configuredName.trim()) throw new Error(`${nameKey} must specify a secret name.`);
    if (target === 'remote' && !configuredFile && !configuredName) {
      throw new Error(`Configure ${nameKey} or ${fileKey}; inline database credentials are not accepted.`);
    }
    const secretName = configuredName || `database-secret-${selectedRole}`;
    const raw = configuredFile
      ? new FileSecretProvider().getSecret(path.resolve(configuredFile), environment)
      : provider.getSecret(secretName, environment);
    // Local non-secret host/port overrides support Docker; never reuse them remotely.
    const url = parseDatabaseSecret(raw, configuredFile ? fileKey : nameKey, target === 'local' ? environment : {});
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname
          || parsed.pathname.length < 2 || !parsed.username) throw new Error();
    } catch { throw new Error(`Invalid PostgreSQL connection in secret for ${target}/${selectedRole}.`); }
    if (target === 'local' && !localHosts.has(parsed.hostname.toLowerCase())) {
      throw new Error('Local target refuses external hosts. Configure a remote secret and use --target remote.');
    }
    return { target, role: selectedRole, url, username: decodeURIComponent(parsed.username) };
  });
}
