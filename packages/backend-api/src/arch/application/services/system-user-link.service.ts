import { randomInt } from 'node:crypto';
import {
  AUTH_SECURITY_DEFAULTS,
  AuditAction,
  AuditResource,
  AuditStatus,
  Cpf,
  EntityAlreadyExistsError,
  ErrorCode,
  UserRole,
  Username,
  ValidationError,
  hashPassword,
  logger,
} from '@openclinic/core';
import type { UnitOfWork } from '../../infrastructure/database/uow.js';
import type { UserEntity } from '../../domain/entities.js';

/**
 * Connectives that carry no identity in a personal name. Dropping them is what turns
 * "Roberto Carlos da Silva" into the candidates "roberto.carlos" / "roberto.carlos.silva".
 */
const NAME_PARTICLES = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'della', 'der', 'van', 'von', 'la', 'le', 'el', 'y',
]);

const PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Separator used between name parts, matching market convention for institution usernames. */
const SEPARATOR = '.';
/** How many numbered fallbacks to try before giving up on an automatic suggestion. */
const MAX_NUMERIC_ATTEMPTS = 50;

export interface SystemUserLinkInput {
  tenant_id: string;
  full_name: string;
  email?: string | null;
  cpf?: string | null;
  /** Requested username. When omitted, one is suggested from the full name. */
  username?: string | null;
  /** Initial password. When omitted, a strong random one is generated. */
  password?: string | null;
  job_title?: string | null;
  role?: UserRole;
  /** Existing IAM account to refresh in place. When it matches nothing, a new account is created. */
  user_id?: string | null;
}

export interface SystemUserLinkResult {
  user_id: string;
  username: string;
  created: boolean;
}

/** Splits a personal name into lowercase, accent-free, identity-bearing tokens. */
export function nameTokens(fullName: string): string[] {
  return fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !NAME_PARTICLES.has(token));
}

/**
 * Username candidates in market-standard order: first+second name, then the full name,
 * then first+last name. Only candidates the Username value object accepts are returned.
 */
export function usernameCandidates(fullName: string): string[] {
  const tokens = nameTokens(fullName);
  const [first] = tokens;
  if (first === undefined) return [];

  const candidates: string[] = [];
  const add = (value: string) => {
    if (!candidates.includes(value) && Username.isValid(value)) candidates.push(value);
  };

  if (tokens.length === 1) {
    add(first);
    return candidates;
  }

  const second = tokens[1]!;
  add(`${first}${SEPARATOR}${second}`);
  if (tokens.length > 2) {
    add(tokens.join(SEPARATOR));
    add(`${first}${SEPARATOR}${tokens.at(-1)!}`);
  }
  return candidates;
}

function truncate(candidate: string, suffix: string): string {
  const budget = Username.MAX_LENGTH - suffix.length;
  return `${candidate.slice(0, Math.max(budget, 1))}${suffix}`;
}

/** True when no active IAM account already owns the candidate. */
export async function isUsernameTaken(uow: UnitOfWork, candidate: string, excludeUserId?: string | null): Promise<boolean> {
  const existing = await uow.users.getByField('username', candidate);
  return existing !== null && existing.id !== excludeUserId;
}

/**
 * Picks the first free username for a person, walking the name-based candidates and then
 * numbered fallbacks. Callers that need the suggestion without persisting it can use this
 * directly; it never writes.
 */
export async function suggestUsername(uow: UnitOfWork, fullName: string, excludeUserId?: string | null): Promise<string> {
  const candidates = usernameCandidates(fullName);
  const [base] = candidates;
  if (base === undefined) {
    throw new ValidationError('username', ErrorCode.VALIDATION_ERROR, { full_name: fullName });
  }

  for (const candidate of candidates) {
    if (!await isUsernameTaken(uow, candidate, excludeUserId)) return candidate;
  }
  for (let attempt = 2; attempt <= MAX_NUMERIC_ATTEMPTS; attempt += 1) {
    const candidate = truncate(base, `${SEPARATOR}${attempt}`);
    if (Username.isValid(candidate) && !await isUsernameTaken(uow, candidate, excludeUserId)) return candidate;
  }
  throw new ValidationError('username', ErrorCode.VALIDATION_ERROR, { full_name: fullName });
}

/** Unbiased random password over an alphabet free of look-alike characters. */
export function generateStrongPassword(length: number): string {
  const size = Math.max(length, AUTH_SECURITY_DEFAULTS.PASSWORD_MIN_LENGTH);
  let password = '';
  for (let index = 0; index < size; index += 1) {
    password += PASSWORD_ALPHABET[randomInt(0, PASSWORD_ALPHABET.length)];
  }
  return password;
}

async function resolvePassword(uow: UnitOfWork, requested?: string | null): Promise<string> {
  const defaultApp = await uow.applications?.getDefaultApplication?.();
  const minLength = defaultApp?.defaultMinPasswordLength ?? AUTH_SECURITY_DEFAULTS.PASSWORD_MIN_LENGTH;
  if (requested === undefined || requested === null || requested === '') return generateStrongPassword(minLength);
  if (requested.length < minLength) throw new ValidationError('password', ErrorCode.PASSWORD_TOO_SHORT);
  return requested;
}

async function bindDefaultGroup(uow: UnitOfWork, userId: string, tenantId: string): Promise<void> {
  try {
    const defaultGroup = await uow.groups.getDefaultGroup(tenantId);
    if (defaultGroup) await uow.groups.addMember(defaultGroup.id, userId);
  } catch (error) {
    logger.warn({ error, userId }, 'Could not auto-link user to default group');
  }
}

/** Refreshes the identity fields of an already linked account. Never resets the password. */
async function refreshLinkedUser(
  uow: UnitOfWork,
  existing: UserEntity,
  input: SystemUserLinkInput,
  email: string,
  cleanedCpf: string | null,
): Promise<SystemUserLinkResult> {
  const fullName = input.full_name.trim();
  const changes: Partial<UserEntity> = {};

  if (email !== existing.email) {
    const clash = await uow.users.getByEmail(email);
    if (clash && clash.id !== existing.id) {
      throw new EntityAlreadyExistsError('User', 'email', email, ErrorCode.USER_EMAIL_EXISTS);
    }
    changes.email = email;
  }

  const requested = input.username?.trim() ? Username.clean(input.username) : '';
  if (requested && requested !== existing.username) {
    if (!Username.isValid(requested)) throw new ValidationError('username', ErrorCode.VALIDATION_ERROR);
    if (await isUsernameTaken(uow, requested, existing.id)) {
      throw new EntityAlreadyExistsError('User', 'username', requested, ErrorCode.USER_USERNAME_EXISTS);
    }
    changes.username = requested;
  }

  if (cleanedCpf && cleanedCpf !== existing.cpf) {
    const clash = await uow.users.getByField('cpf', cleanedCpf);
    if (clash && clash.id !== existing.id) {
      throw new EntityAlreadyExistsError('User', 'cpf', cleanedCpf, ErrorCode.ALREADY_EXISTS);
    }
    changes.cpf = cleanedCpf;
  }

  if (fullName && fullName !== existing.full_name) {
    changes.full_name = fullName;
    if (existing.display_name === existing.full_name) changes.display_name = fullName;
  }

  if (Object.keys(changes).length === 0) {
    return { user_id: existing.id, username: existing.username, created: false };
  }

  const updated = await uow.users.update(existing.id, changes);
  await uow.auditLogs.create({
    user_id: updated.id,
    username: updated.username,
    action: AuditAction.USER_UPDATED_BY_ADMIN,
    resource: AuditResource.IAM_USERS,
    status: AuditStatus.SUCCESS,
    ip_address: null,
    user_agent: null,
    details: { tenant_id: input.tenant_id, fields: Object.keys(changes) },
    tenant_id: input.tenant_id,
  });
  return { user_id: updated.id, username: updated.username, created: false };
}

/**
 * Ensures the person record has a working IAM account: refreshes it when `user_id` already
 * points at one, otherwise creates it with a unique username and a hashed password. The
 * password is never returned — accounts start flagged for a password change.
 */
export async function linkSystemUser(uow: UnitOfWork, input: SystemUserLinkInput): Promise<SystemUserLinkResult> {
  const fullName = input.full_name.trim();
  if (!fullName) throw new ValidationError('full_name', ErrorCode.VALIDATION_ERROR);

  const email = input.email?.trim().toLowerCase();
  if (!email) throw new ValidationError('email', ErrorCode.VALIDATION_ERROR);

  const cleanedCpf = input.cpf ? Cpf.clean(input.cpf) : null;
  if (cleanedCpf && !Cpf.isValid(cleanedCpf)) throw new ValidationError('cpf', ErrorCode.VALIDATION_ERROR);

  if (input.user_id) {
    const existing = await uow.users.getById(input.user_id);
    if (existing) return refreshLinkedUser(uow, existing, input, email, cleanedCpf);
  }

  const existingEmail = await uow.users.getByEmail(email);
  if (existingEmail) {
    throw new EntityAlreadyExistsError('User', 'email', email, ErrorCode.USER_EMAIL_EXISTS);
  }

  const requested = input.username?.trim() ? Username.clean(input.username) : '';
  let username: string;
  if (requested) {
    if (!Username.isValid(requested)) throw new ValidationError('username', ErrorCode.VALIDATION_ERROR);
    if (await isUsernameTaken(uow, requested)) {
      throw new EntityAlreadyExistsError('User', 'username', requested, ErrorCode.USER_USERNAME_EXISTS);
    }
    username = requested;
  } else {
    username = await suggestUsername(uow, fullName);
  }

  if (cleanedCpf) {
    const existingCpf = await uow.users.getByField('cpf', cleanedCpf);
    if (existingCpf) throw new EntityAlreadyExistsError('User', 'cpf', cleanedCpf, ErrorCode.ALREADY_EXISTS);
  }

  const role = input.role ?? UserRole.USER;
  if (!Object.values(UserRole).includes(role)) {
    throw new ValidationError('role', ErrorCode.ROLE_NOT_FOUND, { role });
  }

  const password = await resolvePassword(uow, input.password);
  const hashedPassword = await hashPassword(password);

  const created = await uow.users.create({
    email,
    username,
    cpf: cleanedCpf,
    full_name: fullName,
    display_name: fullName,
    job_title: input.job_title?.trim() || null,
    hashed_password: hashedPassword,
    role,
    tenant_id: input.tenant_id,
    is_active: true,
    is_tenant_owner: false,
    require_password_change: true,
  });

  await bindDefaultGroup(uow, created.id, input.tenant_id);
  await uow.auditLogs.create({
    user_id: created.id,
    username: created.username,
    action: AuditAction.USER_CREATED_BY_ADMIN,
    resource: AuditResource.IAM_USERS,
    status: AuditStatus.SUCCESS,
    ip_address: null,
    user_agent: null,
    details: { role, tenant_id: input.tenant_id, job_title: input.job_title, cpf: cleanedCpf },
    tenant_id: input.tenant_id,
  });
  logger.info({ userId: created.id, role }, 'System account linked to a person record');

  return { user_id: created.id, username: created.username, created: true };
}
