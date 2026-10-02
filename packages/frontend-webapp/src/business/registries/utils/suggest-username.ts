import { Username } from '@openclinic/core/shared';

/**
 * Client-side mirror of the backend's `system-user-link.service.ts` suggestions. The backend
 * stays the authority on uniqueness (it re-checks inside the transaction); this only spares
 * the operator from typing a login and from discovering a clash after submitting.
 */

/** Connectives that carry no identity in a personal name. */
const NAME_PARTICLES = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'della', 'der', 'van', 'von', 'la', 'le', 'el', 'y',
]);

const SEPARATOR = '.';
const MAX_NUMERIC_ATTEMPTS = 50;

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
 * Candidates in market-standard order for institution logins: first+second name, then the
 * full name, then first+last name. "Roberto Carlos da Silva" yields `roberto.carlos`,
 * `roberto.carlos.silva` and `roberto.silva`.
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

/**
 * First free username for a person: the name candidates in order, then numbered fallbacks off
 * the first one. `isTaken` should report a collision against the identities already loaded in
 * the screen; when omitted, the first valid candidate is returned.
 */
export function suggestUsername(fullName: string, isTaken?: (candidate: string) => boolean): string {
  const taken = isTaken ?? (() => false);
  const candidates = usernameCandidates(fullName);
  const [base] = candidates;
  if (base === undefined) return '';

  for (const candidate of candidates) {
    if (!taken(candidate)) return candidate;
  }
  for (let attempt = 2; attempt <= MAX_NUMERIC_ATTEMPTS; attempt += 1) {
    const candidate = truncate(base, `${SEPARATOR}${attempt}`);
    if (Username.isValid(candidate) && !taken(candidate)) return candidate;
  }
  return base;
}
