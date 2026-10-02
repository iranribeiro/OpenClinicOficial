import { describe, it, expect, vi } from 'vitest';
import {
  generateStrongPassword,
  isUsernameTaken,
  nameTokens,
  suggestUsername,
  usernameCandidates,
} from '../../src/arch/application/services/system-user-link.service.js';
import type { UnitOfWork } from '../../src/arch/infrastructure/database/uow.js';

/** Only `users.getByField` is exercised by the suggestion helpers. */
function uowWith(existing: readonly string[]): UnitOfWork {
  const taken = new Set(existing);
  return {
    users: {
      getByField: vi.fn(async (field: string, value: string) => (
        field === 'username' && taken.has(value) ? { id: `user-${value}` } : null
      )),
    },
  } as unknown as UnitOfWork;
}

describe('system-user-link: username suggestion', () => {
  describe('nameTokens', () => {
    it('strips accents and connectives', () => {
      expect(nameTokens('Roberto Carlos da Silva')).toEqual(['roberto', 'carlos', 'silva']);
      expect(nameTokens('José  Ângelo dos Santos')).toEqual(['jose', 'angelo', 'santos']);
    });
  });

  describe('usernameCandidates', () => {
    it('orders first+second, full name, then first+last', () => {
      expect(usernameCandidates('Roberto Carlos da Silva')).toEqual([
        'roberto.carlos',
        'roberto.carlos.silva',
        'roberto.silva',
      ]);
    });

    it('returns no candidate for a name of connectives only', () => {
      expect(usernameCandidates('da Silva')).toEqual(['silva']);
      expect(usernameCandidates('de la')).toEqual([]);
    });
  });

  describe('isUsernameTaken', () => {
    it('treats the account being refreshed as free', async () => {
      const uow = uowWith(['roberto.carlos']);
      expect(await isUsernameTaken(uow, 'roberto.carlos')).toBe(true);
      expect(await isUsernameTaken(uow, 'roberto.carlos', 'user-roberto.carlos')).toBe(false);
    });
  });

  describe('suggestUsername', () => {
    it('returns the market-standard first candidate when free', async () => {
      expect(await suggestUsername(uowWith([]), 'Roberto Carlos da Silva')).toBe('roberto.carlos');
    });

    it('walks to first+middle+last when the short form is taken', async () => {
      expect(await suggestUsername(uowWith(['roberto.carlos']), 'Roberto Carlos da Silva'))
        .toBe('roberto.carlos.silva');
    });

    it('walks to first+last when the full name is also taken', async () => {
      const uow = uowWith(['roberto.carlos', 'roberto.carlos.silva']);
      expect(await suggestUsername(uow, 'Roberto Carlos da Silva')).toBe('roberto.silva');
    });

    it('numbers the base once every name candidate is taken', async () => {
      const uow = uowWith(['roberto.carlos', 'roberto.carlos.silva', 'roberto.silva']);
      expect(await suggestUsername(uow, 'Roberto Carlos da Silva')).toBe('roberto.carlos.2');
    });

    it('skips numbered candidates that are taken too', async () => {
      const uow = uowWith(['roberto.carlos', 'roberto.carlos.2']);
      expect(await suggestUsername(uow, 'Roberto Carlos')).toBe('roberto.carlos.3');
    });

    it('rejects a name that yields no usable candidate', async () => {
      await expect(suggestUsername(uowWith([]), 'de la')).rejects.toThrow();
    });
  });

  describe('generateStrongPassword', () => {
    it('honours the requested length and stays unambiguous', () => {
      const password = generateStrongPassword(24);
      expect(password).toHaveLength(24);
      expect(password).toMatch(/^[a-zA-Z0-9]+$/);
      // Look-alike characters are excluded from the alphabet by construction.
      expect(password).not.toMatch(/[0O1lI]/);
    });

    it('never repeats across calls', () => {
      const generated = new Set(Array.from({ length: 50 }, () => generateStrongPassword(20)));
      expect(generated.size).toBe(50);
    });
  });
});
