import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FileSecretProvider } from '@openclinic/core/server';
import { resolveDbCheckTargets } from '../src/utils/db-check-targets.js';

afterEach(() => vi.restoreAllMocks());

describe('db:check secret targets', () => {
  it.each([{ target: 'typo' }, { role: 'admin' }])('rejects invalid options before secret access: %j', options => {
    const reader = vi.spyOn(FileSecretProvider.prototype, 'getSecret');
    expect(() => resolveDbCheckTargets(options, {})).toThrow(/Invalid/);
    expect(reader).not.toHaveBeenCalled();
  });

  it('reads the requested local app secret instead of inline credentials', () => {
    const reader = vi.spyOn(FileSecretProvider.prototype, 'getSecret').mockReturnValue('postgresql://app:test@localhost:5432/local_db');
    const [result] = resolveDbCheckTargets({ role: 'app' }, {
      DB_APP_SECRET_NAME: 'local-app', DATABASE_URL: 'postgresql://wrong:wrong@external.example/live',
    });
    expect(reader).toHaveBeenCalledWith('local-app', expect.anything());
    expect(result?.username).toBe('app');
    expect(result?.url).toContain('/local_db');
  });

  it('rejects inline credentials when the secret cannot be read', () => {
    vi.spyOn(FileSecretProvider.prototype, 'getSecret').mockImplementation(() => { throw new Error('Secret missing'); });
    expect(() => resolveDbCheckTargets({ role: 'app' }, {
      DATABASE_URL: 'postgresql://app:test@localhost/local_db', DB_USER: 'app', DB_PASS: 'test',
    })).toThrow('Secret missing');
  });

  it('rejects an external host from a local secret', () => {
    vi.spyOn(FileSecretProvider.prototype, 'getSecret').mockReturnValue('postgresql://app:test@external.example/live');
    expect(() => resolveDbCheckTargets({ role: 'app' }, {})).toThrow(/refuses external hosts/);
  });

  it('also validates local host overrides of structured secrets', () => {
    vi.spyOn(FileSecretProvider.prototype, 'getSecret').mockReturnValue(JSON.stringify({ user: 'app', password: 'test', database: 'local_db', host: 'localhost' }));
    expect(() => resolveDbCheckTargets({ role: 'app' }, { DB_HOST: 'external.example' })).toThrow(/refuses external hosts/);
  });

  it('selects both remote roles and does not use local host overrides', () => {
    const reader = vi.spyOn(FileSecretProvider.prototype, 'getSecret').mockImplementation(name => JSON.stringify({
      user: name === 'remote-app' ? 'app' : 'owner', password: 'synthetic', host: 'remote.example', port: 5433, database: 'remote_db',
    }));
    const results = resolveDbCheckTargets({ target: 'remote', role: 'all' }, {
      REMOTE_DB_APP_SECRET_NAME: 'remote-app', REMOTE_DB_OWNER_SECRET_NAME: 'remote-owner',
      DB_HOST: 'localhost', DB_PORT: '9999', DB_NAME: 'local_db',
    });
    expect(results.map(result => result.role)).toEqual(['app', 'owner']);
    expect(results.map(result => result.username)).toEqual(['app', 'owner']);
    expect(results.every(result => result.url.includes('remote.example:5433/remote_db'))).toBe(true);
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it('does not require or substitute the owner secret when remote app is requested', () => {
    const reader = vi.spyOn(FileSecretProvider.prototype, 'getSecret').mockReturnValue('postgresql://app:test@remote.example/remote_db');
    const results = resolveDbCheckTargets({ target: 'remote', role: 'app' }, { REMOTE_DB_APP_SECRET_NAME: 'remote-app' });
    expect(results).toHaveLength(1);
    expect(results[0]?.role).toBe('app');
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it('refuses incomplete remote all configuration without falling back to local secrets', () => {
    vi.spyOn(FileSecretProvider.prototype, 'getSecret').mockReturnValue('postgresql://app:test@remote.example/remote_db');
    expect(() => resolveDbCheckTargets({ target: 'remote' }, { REMOTE_DB_APP_SECRET_NAME: 'remote-app' }))
      .toThrow(/REMOTE_DB_OWNER_SECRET_NAME/);
  });

  it('supports an explicit mounted secret file', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'db-check-secret-test-'));
    const file = path.join(folder, 'app-secret');
    fs.writeFileSync(file, 'postgresql://app:synthetic@localhost/local_db');
    try {
      const [result] = resolveDbCheckTargets({ role: 'app' }, { DATABASE_URL_FILE: file });
      expect(result?.username).toBe('app');
    } finally { fs.unlinkSync(file); fs.rmdirSync(folder); }
  });

  it('does not expose secret contents in invalid URL errors', () => {
    vi.spyOn(FileSecretProvider.prototype, 'getSecret').mockReturnValue('postgresql://app:private-value@');
    expect(() => resolveDbCheckTargets({ role: 'app' }, {})).toThrow(/invalid PostgreSQL URL/i);
    try { resolveDbCheckTargets({ role: 'app' }, {}); }
    catch (error) { expect(String(error)).not.toContain('private-value'); }
  });
});
