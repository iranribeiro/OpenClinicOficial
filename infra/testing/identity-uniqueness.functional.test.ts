import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { Cpf } from '@openclinic/core';
import { startApiHarness, type ApiHarness } from './api-harness.js';

// Behavioral oracle: docs/cadastros.md -- registering a professional or a collaborator creates
// their IAM account, and that account is identified by a unique email, CPF and username.
//
// Identity is application-wide, not per-tenant: authentication resolves an account from the
// identifier alone, with no tenant in the request. These tests exist to pin that down at the two
// levels that matter -- the published API, and the schema that has to hold when two writers race.
let api: ApiHarness;
const base = '/api/v1/business/practitioners';

before(async () => { api = await startApiHarness(); });
after(async () => { await api?.close(); });

/** A valid CPF, so a rejection here is about uniqueness and never about the check digits. */
const VALID_CPF = '11144477735';

/**
 * Builds a valid CPF whose digits belong to this run alone. The schema test below needs a CPF that is
 * valid (a rejection must mean "already taken", never "malformed") and that no other test has claimed
 * -- the harness shares one database across the file, so a fixed constant would couple the tests to
 * each other's execution order.
 */
function randomValidCpf(): string {
  const digits = Array.from({ length: 9 }, () => randomInt(0, 10));
  for (const length of [9, 10]) {
    const sum = digits.slice(0, length).reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
    digits.push(((sum * 10) % 11) % 10);
  }
  return digits.join('');
}

test('[SEC-IDENTITY] a person cadastro cannot reuse an identity held by another tenant', async () => {
  const first = await api.identity();
  const email = `shared-${randomUUID()}@example.test`;
  const username = `shared-${randomUUID().replaceAll('-', '').slice(0, 12)}`;

  const created = await api.expectHttp(201, 'POST', base, first.token, {
    full_name: 'First Professional', email, cpf: VALID_CPF, username,
    registrations: [{ registration_type: 'CRM', registration_number: '300001', registration_state: 'SP', is_primary: true }],
  });
  // The cadastro is what creates the account, so the identity now has an owner.
  const [account] = await api.sql`SELECT id FROM iam_users WHERE lower(email) = ${email}`;
  assert.ok(account, 'the cadastro must have created the system account');

  const second = await api.identity();
  for (const field of ['email', 'cpf', 'username'] as const) {
    const body = {
      full_name: 'Second Professional',
      email: field === 'email' ? email : `other-${randomUUID()}@example.test`,
      ...(field === 'cpf' ? { cpf: VALID_CPF } : {}),
      ...(field === 'username' ? { username } : {}),
      registrations: [{ registration_type: 'CRM', registration_number: '300002', registration_state: 'SP', is_primary: true }],
    };
    const response = await api.request('POST', base, second.token, body);
    assert.equal(response.status, 409, `a duplicate ${field} from another tenant must conflict: ${response.text}`);
    // The conflict tells the caller the identifier is taken. It must not tell them where it lives.
    assert.ok(!response.text.includes(first.tenant), `the conflict must not disclose the holding tenant: ${response.text}`);
  }

  assert.ok(created.id);
});

test('[SEC-IDENTITY] the schema enforces identity uniqueness, so racing writers cannot bypass it', async () => {
  const suffix = randomUUID().replaceAll('-', '');
  const email = `index-${suffix}@example.test`;
  const username = `index-${suffix}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const cpf = randomValidCpf();
  assert.ok(Cpf.isValid(cpf), `the probe CPF must be valid: ${cpf}`);
  await api.sql`INSERT INTO sys_tenants (id, name) VALUES (${tenantA}, 'Identity A'), (${tenantB}, 'Identity B')`;

  const insertUser = (tenant: string | null, fields: { email: string; username: string; cpf: string | null }) =>
    api.sql`INSERT INTO iam_users (id, tenant_id, username, email, full_name, display_name, role, cpf)
      VALUES (${randomUUID()}, ${tenant}, ${fields.username}, ${fields.email}, 'Index Probe', 'Index Probe', 'USER', ${fields.cpf})`;

  await insertUser(tenantA, { email, username, cpf });

  // Every identity field spans the whole table, not the tenant it was registered in.
  await assert.rejects(insertUser(tenantB, { email, username: `e-${suffix}`, cpf: null }), /idx_iam_users_email_global/);
  await assert.rejects(insertUser(tenantB, { email: `u-${suffix}@example.test`, username, cpf: null }), /idx_iam_users_username_global/);
  await assert.rejects(insertUser(tenantB, { email: `c-${suffix}@example.test`, username: `c-${suffix}`, cpf }), /idx_iam_users_cpf_global/);

  // Not even within one tenant, and not for platform accounts, whose NULL tenant_id the previous
  // composite index exempted outright because a unique btree treats NULL as distinct.
  await assert.rejects(insertUser(tenantA, { email, username: `s-${suffix}`, cpf: null }), /idx_iam_users_email_global/);
  await assert.rejects(insertUser(null, { email, username: `n-${suffix}`, cpf: null }), /idx_iam_users_email_global/);

  // Casing is not a way around it: every read path lowercases the identifier it is given.
  await assert.rejects(insertUser(tenantB, { email: email.toUpperCase(), username: `x-${suffix}`, cpf: null }), /idx_iam_users_email_global/);

  // A soft-deleted account releases its identifier instead of holding it forever, which is also
  // what lets a data subject be registered again.
  await api.sql`UPDATE iam_users SET deleted_at = now() WHERE lower(email) = ${email}`;
  await insertUser(tenantB, { email, username, cpf });

  // CPF is optional, so accounts that have none are never forced to collide with each other.
  await insertUser(tenantB, { email: `p-${suffix}@example.test`, username: `p-${suffix}`, cpf: null });
  await insertUser(tenantB, { email: `q-${suffix}@example.test`, username: `q-${suffix}`, cpf: null });
});

test('[SEC-IDENTITY] a username cannot take the shape of a CPF', async () => {
  const identity = await api.identity();
  const email = `shape-${randomUUID()}@example.test`;
  // Eleven digits is exactly what getByIdentifier would also read as a CPF. If this became a
  // username, whoever holds that CPF would share an identifier with this account at login.
  const cpfShapedUsername = '12345678909';

  const response = await api.request('POST', base, identity.token, {
    full_name: 'Shape Probe', email, username: cpfShapedUsername,
    registrations: [{ registration_type: 'CRM', registration_number: '300003', registration_state: 'SP', is_primary: true }],
  });

  assert.equal(response.status, 400, `a CPF-shaped username must be rejected: ${response.text}`);
  // Rejected before anything was written, so the value never became a login.
  const [account] = await api.sql`SELECT id FROM iam_users WHERE username = ${cpfShapedUsername}`;
  assert.equal(account, undefined, 'the rejected username must not have reached the table');
});
