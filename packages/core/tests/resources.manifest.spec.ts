import { describe, it, expect } from 'vitest';
import {
  APP_RESOURCE_MANIFEST,
  ApplicationContext,
  UserRole,
} from '../src/index.js';

describe('Application Resources Manifest (SSOT)', () => {
  it('should define exactly 26 canonical resources', () => {
    expect(APP_RESOURCE_MANIFEST.length).toBe(26);
  });

  it('should have unique item codes for every resource', () => {
    const codes = APP_RESOURCE_MANIFEST.map((r) => r.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it('should have unique routes for all navigable resources', () => {
    const routes = APP_RESOURCE_MANIFEST.map((r) => r.route).filter((r): r is NonNullable<typeof r> => Boolean(r));
    const uniqueRoutes = new Set(routes);
    expect(uniqueRoutes.size).toBe(routes.length);
  });

  it('should strictly use canonical architecture context (ARCH vs BUSINESS)', () => {
    for (const res of APP_RESOURCE_MANIFEST) {
      expect([ApplicationContext.ARCH, ApplicationContext.BUSINESS]).toContain(res.context);
    }
  });

  it('should assign valid UserRoles as minRole', () => {
    for (const res of APP_RESOURCE_MANIFEST) {
      expect([UserRole.USER, UserRole.ADMIN, UserRole.OWNER]).toContain(res.minRole);
    }
  });

  it('should conform to canonical naming prefixes based on section (Option A: <section>_<item>)', () => {
    for (const res of APP_RESOURCE_MANIFEST) {
      expect(res.code.startsWith(`${res.section}_`)).toBe(true);
    }
  });

  it('should enforce English kebab-case format for all routes', () => {
    for (const res of APP_RESOURCE_MANIFEST) {
      if (res.route) {
        expect(res.route).toMatch(/^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/);
      }
    }
  });

  it('should strictly align every route with its section namespace (/<section>/...)', () => {
    for (const res of APP_RESOURCE_MANIFEST) {
      if (res.route) {
        expect(res.route.startsWith(`/${res.section}/`)).toBe(true);
      }
    }
  });
});
