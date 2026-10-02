import { describe, it, expect } from 'vitest';
import { Username } from '@openclinic/core/shared';
import {
  nameTokens,
  usernameCandidates,
  suggestUsername,
} from '../src/business/registries/utils/suggest-username.js';

describe('suggest-username', () => {
  describe('nameTokens', () => {
    it('drops connectives and accent-free normalizes the name', () => {
      expect(nameTokens('Roberto Carlos da Silva')).toEqual(['roberto', 'carlos', 'silva']);
      expect(nameTokens('José  Ângelo dos Santos')).toEqual(['jose', 'angelo', 'santos']);
      expect(nameTokens('Ana-Maria de Souza')).toEqual(['ana', 'maria', 'souza']);
    });
  });

  describe('usernameCandidates', () => {
    it('leads with the first two names, then the full name, then first+last', () => {
      expect(usernameCandidates('Roberto Carlos da Silva')).toEqual([
        'roberto.carlos',
        'roberto.carlos.silva',
        'roberto.silva',
      ]);
    });

    it('returns the single name when there is nothing else to join', () => {
      expect(usernameCandidates('Madonna')).toEqual(['madonna']);
      expect(usernameCandidates('Roberto Silva')).toEqual(['roberto.silva']);
    });

    it('returns nothing for a name with no identity-bearing token', () => {
      expect(usernameCandidates('de la')).toEqual([]);
      expect(usernameCandidates('')).toEqual([]);
    });

    it('never returns a candidate the Username value object rejects', () => {
      // 'e' and 'y' are connectives; a two-letter first name is below the 3-char minimum only
      // as a whole candidate, so the joined form still has to clear validation.
      for (const candidate of usernameCandidates('Roberto Carlos da Silva')) {
        expect(candidate).toMatch(new RegExp(Username.PATTERN));
        expect(Username.isValid(candidate)).toBe(true);
      }
    });
  });

  describe('suggestUsername', () => {
    it('takes the first candidate when nothing collides', () => {
      expect(suggestUsername('Roberto Carlos da Silva')).toBe('roberto.carlos');
    });

    it('walks the remaining candidates before numbering', () => {
      const taken = new Set(['roberto.carlos']);
      expect(suggestUsername('Roberto Carlos da Silva', (c) => taken.has(c))).toBe('roberto.carlos.silva');
    });

    it('falls back to a numbered suffix once every candidate is taken', () => {
      const taken = new Set(['roberto.carlos', 'roberto.carlos.silva', 'roberto.silva']);
      expect(suggestUsername('Roberto Carlos da Silva', (c) => taken.has(c))).toBe('roberto.carlos.2');
    });

    it('returns an empty string when the name yields no candidate', () => {
      expect(suggestUsername('da')).toBe('');
    });
  });
});
