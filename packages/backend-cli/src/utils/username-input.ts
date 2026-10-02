import { Username } from '@openclinic/core';

/**
 * Explains the rule the value object enforces, for someone typing a username by hand. The rule
 * itself is not restated here: `Username.isValid` is the authority, and this string only says what
 * to do about it.
 */
export const USERNAME_RULE = 'must start with a letter, 3-50 chars (letters, digits, dot, underscore, hyphen)';

export type UsernameInputCheck =
  | { valid: true; username: string }
  | { valid: false; reason: string };

/**
 * Reads a username typed at the CLI the way the API reads it.
 *
 * The command writes with raw SQL, so it bypasses the request schemas and the repository guard that
 * enforce this rule on the API paths. The interactive prompt covers only the person answering it:
 * a scripted `--username 12345678901` never sees a prompt, and a username of only digits is what
 * the rule exists to refuse -- `getByIdentifier` resolves an account by `email OR username OR cpf`,
 * so such a username would shadow somebody's CPF at login.
 *
 * Returns the canonical form, so the stored value, the collision lookups and the unique index all
 * compare the same thing.
 */
export function checkUsernameInput(value: unknown): UsernameInputCheck {
  if (typeof value !== 'string' || !value.trim()) {
    return { valid: false, reason: `username is required ${USERNAME_RULE}` };
  }

  const username = Username.clean(value);
  if (!Username.isValid(username)) {
    return { valid: false, reason: `"${value}" is not a valid username -- ${USERNAME_RULE}` };
  }

  return { valid: true, username };
}
