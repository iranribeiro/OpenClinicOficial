import { describe, expect, it } from 'vitest';
import { BOOTSTRAP_DEFAULTS } from '@openclinic/core';
import { checkUsernameInput } from '../src/utils/username-input.js';

// The CLI writes with raw SQL, so it bypasses the request schemas and the repository guard that
// enforce the username rule on the API paths. These tests pin the rule down on the one path that
// has no other gate behind it.
describe('CLI username input', () => {
  it('accepts the username this command defaults to', () => {
    const result = checkUsernameInput(BOOTSTRAP_DEFAULTS.DEFAULT_OWNER_USERNAME);
    expect(result).toEqual({ valid: true, username: BOOTSTRAP_DEFAULTS.DEFAULT_OWNER_USERNAME });
  });

  it('returns the canonical form, so the stored value matches the lookups', () => {
    expect(checkUsernameInput('  Dr.Silva  ')).toEqual({ valid: true, username: 'dr.silva' });
  });

  it('refuses a username shaped like a CPF, which would shadow one at login', () => {
    // getByIdentifier resolves an account by email OR username OR cpf, so an all-digit username is
    // indistinguishable from a CPF -- including the OWNER's own bootstrap CPF.
    expect(checkUsernameInput(BOOTSTRAP_DEFAULTS.DEFAULT_OWNER_CPF).valid).toBe(false);
    expect(checkUsernameInput('12345678901').valid).toBe(false);
  });

  it.each([
    ['a digit-first username', '1abc'],
    ['a separator-first username', '_abc'],
    ['an all-digit username shorter than a CPF', '123'],
    ['a username below the minimum length', 'ab'],
    ['a username that is only separators', '...'],
  ])('refuses %s', (_label, value) => {
    expect(checkUsernameInput(value).valid).toBe(false);
  });

  it.each([
    ['a missing flag', undefined],
    ['a blank value', '   '],
    ['a non-string value', 12345678901],
  ])('refuses %s', (_label, value) => {
    const result = checkUsernameInput(value);
    expect(result.valid).toBe(false);
    // The message must not echo a value that was never a string, and must not leak a password-like
    // argument back to a terminal that may be logged.
    if (!result.valid) expect(result.reason).toContain('required');
  });

  it('keeps digits after a leading letter, which is where most usernames live', () => {
    expect(checkUsernameInput('abc123')).toEqual({ valid: true, username: 'abc123' });
    expect(checkUsernameInput('a1b2')).toEqual({ valid: true, username: 'a1b2' });
  });
});
