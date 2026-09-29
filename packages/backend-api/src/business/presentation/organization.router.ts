import type { FastifyInstance } from 'fastify';
import {
  type JwtConfig,
  UserRole,
  EntityNotFoundError,
} from '@openclinic/core';
import type { UnitOfWork } from '../../arch/infrastructure/database/uow.js';
import {
  appOrganizations,
  appOrganizationUnits,
  appRooms,
} from '../../arch/infrastructure/database/drizzle-schema.js';
import { eq, and, isNull, desc, asc } from 'drizzle-orm';
import { createAuthenticateJwt } from '../../arch/presentation/middlewares/authenticate-jwt.js';
import { requireRole } from '../../arch/presentation/middlewares/require-permission.js';
import { SecurityBearer, StandardErrorResponses } from '../../arch/presentation/openapi.schemas.js';
import { randomUUID } from 'node:crypto';

export const ORGANIZATION_SWAGGER_TAG = 'Business & Registries: Organizations';

export interface ApiOrganizationPayload {
  id?: string;
  legalName: string;
  tradeName: string;
  taxId?: string;
  cnpj: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  email?: string;
  phone?: string;
  website?: string;
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
  autoCreateHeadquarters?: boolean;
}

export interface ApiUnitPayload {
  id?: string;
  organizationId: string;
  name: string;
  tradeName?: string;
  cnesCode: string;
  taxId?: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  isHeadquarters?: boolean;
  isActive?: boolean;
}


function toOrganizationResponse(row: typeof appOrganizations.$inferSelect) {
  return {
    id: row.id,
    legalName: row.legal_name,
    tradeName: row.trade_name,
    taxId: row.tax_id ?? undefined,
    cnpj: row.cnpj ?? '',
    stateRegistration: row.state_registration ?? undefined,
    municipalRegistration: row.municipal_registration ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    postalCode: row.postal_code ?? undefined,
    street: row.street ?? undefined,
    number: row.number ?? undefined,
    complement: row.complement ?? undefined,
    neighborhood: row.neighborhood ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    country: row.country ?? undefined,
    isActive: Boolean(row.is_active),
  };
}

function toUnitResponse(row: typeof appOrganizationUnits.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    tradeName: row.trade_name ?? undefined,
    cnesCode: row.cnes_code ?? '',
    taxId: row.tax_id ?? undefined,
    cnpj: row.cnpj ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    postalCode: row.postal_code ?? undefined,
    street: row.street ?? undefined,
    number: row.number ?? undefined,
    complement: row.complement ?? undefined,
    neighborhood: row.neighborhood ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    country: row.country ?? undefined,
    isHeadquarters: Boolean(row.is_headquarters),
    isActive: Boolean(row.is_active),
  };
}


export function registerOrganizationRoutes(
  app: FastifyInstance,
  uow: UnitOfWork,
  jwtConfig: JwtConfig
): void {
  const authenticateJwt = createAuthenticateJwt(jwtConfig, uow);

  // ── ORGANIZATIONS ──────────────────────────────────────────────────────────

  // GET /api/v1/business/organizations
  app.get(
    '/api/v1/business/organizations',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.USER)],
      schema: {
        tags: [ORGANIZATION_SWAGGER_TAG],
        summary: 'List Organizations',
        description: 'Returns all active organizations for the current tenant.',
        security: SecurityBearer,
        response: {
          200: {
            description: 'List of organizations',
            type: 'array',
            items: { type: 'object', additionalProperties: true },
          },
          ...StandardErrorResponses,
        },
      },
    },
    async (_request, reply) => {
      const rows = await uow.db
        .select()
        .from(appOrganizations)
        .where(isNull(appOrganizations.deleted_at))
        .orderBy(asc(appOrganizations.trade_name));

      return reply.status(200).send(rows.map(toOrganizationResponse));
    }
  );

  // GET /api/v1/business/organizations/:id
  app.get<{ Params: { id: string } }>(
    '/api/v1/business/organizations/:id',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.USER)],
      schema: {
        tags: [ORGANIZATION_SWAGGER_TAG],
        summary: 'Get Organization By ID',
        security: SecurityBearer,
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          ...StandardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      const [row] = await uow.db
        .select()
        .from(appOrganizations)
        .where(and(eq(appOrganizations.id, request.params.id), isNull(appOrganizations.deleted_at)))
        .limit(1);

      if (!row) {
        throw new EntityNotFoundError('Organization', request.params.id);
      }
      return reply.status(200).send(toOrganizationResponse(row));
    }
  );

  // POST /api/v1/business/organizations
  app.post<{ Body: ApiOrganizationPayload }>(
    '/api/v1/business/organizations',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.ADMIN)],
      schema: {
        tags: [ORGANIZATION_SWAGGER_TAG],
        summary: 'Create Organization',
        security: SecurityBearer,
        body: {
          type: 'object',
          required: ['legalName', 'tradeName', 'cnpj'],
          properties: {
            legalName: { type: 'string' },
            tradeName: { type: 'string' },
            cnpj: { type: 'string' },
          },
          additionalProperties: true,
        },
        response: {
          201: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          ...StandardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const user = request.user!;
      const tenantId = user.tenant_id ?? 'ee720158-6f98-42c3-b371-3d216d7f421a';
      const orgId = body.id || `org-${randomUUID().slice(0, 8)}`;

      const [insertedOrg] = await uow.db
        .insert(appOrganizations)
        .values({
          id: orgId,
          tenant_id: tenantId,
          legal_name: body.legalName,
          trade_name: body.tradeName,
          tax_id: body.taxId || null,
          cnpj: body.cnpj,
          state_registration: body.stateRegistration || null,
          municipal_registration: body.municipalRegistration || null,
          email: body.email || null,
          phone: body.phone || null,
          website: body.website || null,
          postal_code: body.postalCode || null,
          street: body.street || null,
          number: body.number || null,
          complement: body.complement || null,
          neighborhood: body.neighborhood || null,
          city: body.city || null,
          state: body.state || null,
          country: body.country || 'BRA',
          is_active: body.isActive ?? true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      // Auto-provision headquarters unit & room if requested
      if (body.autoCreateHeadquarters) {
        const unitId = `unit-${randomUUID().slice(0, 8)}`;
        await uow.db.insert(appOrganizationUnits).values({
          id: unitId,
          tenant_id: tenantId,
          organization_id: orgId,
          name: `${body.tradeName} (Sede)`,
          trade_name: body.tradeName,
          cnes_code: '0000000',
          cnpj: body.cnpj,
          phone: body.phone || null,
          email: body.email || null,
          postal_code: body.postalCode || null,
          street: body.street || null,
          number: body.number || null,
          complement: body.complement || null,
          neighborhood: body.neighborhood || null,
          city: body.city || null,
          state: body.state || null,
          country: body.country || 'BRA',
          is_headquarters: true,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        });

        await uow.db.insert(appRooms).values({
          id: `room-${randomUUID().slice(0, 8)}`,
          tenant_id: tenantId,
          unit_id: unitId,
          name: 'Consultório 1 - Atendimento Geral',
          room_type: 'CONSULTORIO',
          is_schedulable: true,
          equipment: [],
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      return reply.status(201).send({
        code: 'SUCCESS',
        message: 'Organization created successfully',
        data: toOrganizationResponse(insertedOrg),
      });
    }
  );

  // PUT /api/v1/business/organizations/:id
  app.put<{ Params: { id: string }; Body: Partial<ApiOrganizationPayload> }>(
    '/api/v1/business/organizations/:id',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.ADMIN)],
      schema: {
        tags: [ORGANIZATION_SWAGGER_TAG],
        summary: 'Update Organization',
        security: SecurityBearer,
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          ...StandardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const updateData: Record<string, unknown> = {
        updated_at: new Date(),
      };
      if (body.legalName !== undefined) updateData.legal_name = body.legalName;
      if (body.tradeName !== undefined) updateData.trade_name = body.tradeName;
      if (body.taxId !== undefined) updateData.tax_id = body.taxId;
      if (body.cnpj !== undefined) updateData.cnpj = body.cnpj;
      if (body.stateRegistration !== undefined) updateData.state_registration = body.stateRegistration;
      if (body.municipalRegistration !== undefined) updateData.municipal_registration = body.municipalRegistration;
      if (body.email !== undefined) updateData.email = body.email;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.website !== undefined) updateData.website = body.website;
      if (body.postalCode !== undefined) updateData.postal_code = body.postalCode;
      if (body.street !== undefined) updateData.street = body.street;
      if (body.number !== undefined) updateData.number = body.number;
      if (body.complement !== undefined) updateData.complement = body.complement;
      if (body.neighborhood !== undefined) updateData.neighborhood = body.neighborhood;
      if (body.city !== undefined) updateData.city = body.city;
      if (body.state !== undefined) updateData.state = body.state;
      if (body.country !== undefined) updateData.country = body.country;
      if (body.isActive !== undefined) updateData.is_active = body.isActive;

      const [updated] = await uow.db
        .update(appOrganizations)
        .set(updateData)
        .where(and(eq(appOrganizations.id, request.params.id), isNull(appOrganizations.deleted_at)))
        .returning();

      if (!updated) {
        throw new EntityNotFoundError('Organization', request.params.id);
      }

      return reply.status(200).send({
        code: 'SUCCESS',
        message: 'Organization updated successfully',
        data: toOrganizationResponse(updated),
      });
    }
  );

  // DELETE /api/v1/business/organizations/:id
  app.delete<{ Params: { id: string } }>(
    '/api/v1/business/organizations/:id',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.ADMIN)],
      schema: {
        tags: [ORGANIZATION_SWAGGER_TAG],
        summary: 'Deactivate / Soft Delete Organization',
        security: SecurityBearer,
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
          ...StandardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      await uow.db
        .update(appOrganizations)
        .set({ is_active: false, updated_at: new Date() })
        .where(eq(appOrganizations.id, request.params.id));

      return reply.status(200).send({
        code: 'SUCCESS',
        message: 'Organization deactivated successfully',
      });
    }
  );

  // ── ORGANIZATION UNITS ─────────────────────────────────────────────────────

  // GET /api/v1/business/organization-units
  app.get<{ Querystring: { organizationId?: string } }>(
    '/api/v1/business/organization-units',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.USER)],
      schema: {
        tags: [ORGANIZATION_SWAGGER_TAG],
        summary: 'List Organization Units',
        security: SecurityBearer,
        querystring: {
          type: 'object',
          properties: { organizationId: { type: 'string' } },
        },
        response: {
          200: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
          },
          ...StandardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      const { organizationId } = request.query;
      let query = uow.db
        .select()
        .from(appOrganizationUnits)
        .where(isNull(appOrganizationUnits.deleted_at));

      if (organizationId) {
        query = uow.db
          .select()
          .from(appOrganizationUnits)
          .where(and(eq(appOrganizationUnits.organization_id, organizationId), isNull(appOrganizationUnits.deleted_at)));
      }

      const rows = await query.orderBy(desc(appOrganizationUnits.is_headquarters), asc(appOrganizationUnits.name));
      return reply.status(200).send(rows.map(toUnitResponse));
    }
  );

  // POST /api/v1/business/organization-units
  app.post<{ Body: ApiUnitPayload }>(
    '/api/v1/business/organization-units',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.ADMIN)],
      schema: {
        tags: [ORGANIZATION_SWAGGER_TAG],
        summary: 'Create Organization Unit',
        security: SecurityBearer,
        body: {
          type: 'object',
          required: ['organizationId', 'name', 'cnesCode'],
          additionalProperties: true,
        },
        response: {
          201: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          ...StandardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const user = request.user!;
      const tenantId = user.tenant_id ?? 'ee720158-6f98-42c3-b371-3d216d7f421a';
      const unitId = body.id || `unit-${randomUUID().slice(0, 8)}`;

      // Demote previous headquarters if this new unit is headquarters
      if (body.isHeadquarters) {
        await uow.db
          .update(appOrganizationUnits)
          .set({ is_headquarters: false, updated_at: new Date() })
          .where(eq(appOrganizationUnits.organization_id, body.organizationId));
      }

      const [inserted] = await uow.db
        .insert(appOrganizationUnits)
        .values({
          id: unitId,
          tenant_id: tenantId,
          organization_id: body.organizationId,
          name: body.name,
          trade_name: body.tradeName || null,
          cnes_code: body.cnesCode,
          tax_id: body.taxId || null,
          cnpj: body.cnpj || null,
          phone: body.phone || null,
          email: body.email || null,
          postal_code: body.postalCode || null,
          street: body.street || null,
          number: body.number || null,
          complement: body.complement || null,
          neighborhood: body.neighborhood || null,
          city: body.city || null,
          state: body.state || null,
          country: body.country || 'BRA',
          is_headquarters: Boolean(body.isHeadquarters),
          is_active: body.isActive ?? true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      return reply.status(201).send({
        code: 'SUCCESS',
        message: 'Organization unit created successfully',
        data: toUnitResponse(inserted),
      });
    }
  );

  // PUT /api/v1/business/organization-units/:id
  app.put<{ Params: { id: string }; Body: Partial<ApiUnitPayload> }>(
    '/api/v1/business/organization-units/:id',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.ADMIN)],
      schema: {
        tags: [ORGANIZATION_SWAGGER_TAG],
        summary: 'Update Organization Unit',
        security: SecurityBearer,
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          ...StandardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const unitId = request.params.id;

      // Check current
      const [current] = await uow.db
        .select()
        .from(appOrganizationUnits)
        .where(eq(appOrganizationUnits.id, unitId))
        .limit(1);

      if (!current) {
        throw new EntityNotFoundError('OrganizationUnit', unitId);
      }

      // If promoting to headquarters, demote existing
      if (body.isHeadquarters) {
        await uow.db
          .update(appOrganizationUnits)
          .set({ is_headquarters: false, updated_at: new Date() })
          .where(eq(appOrganizationUnits.organization_id, current.organization_id));
      }

      const updateData: Record<string, unknown> = { updated_at: new Date() };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.tradeName !== undefined) updateData.trade_name = body.tradeName;
      if (body.cnesCode !== undefined) updateData.cnes_code = body.cnesCode;
      if (body.taxId !== undefined) updateData.tax_id = body.taxId;
      if (body.cnpj !== undefined) updateData.cnpj = body.cnpj;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.email !== undefined) updateData.email = body.email;
      if (body.postalCode !== undefined) updateData.postal_code = body.postalCode;
      if (body.street !== undefined) updateData.street = body.street;
      if (body.number !== undefined) updateData.number = body.number;
      if (body.complement !== undefined) updateData.complement = body.complement;
      if (body.neighborhood !== undefined) updateData.neighborhood = body.neighborhood;
      if (body.city !== undefined) updateData.city = body.city;
      if (body.state !== undefined) updateData.state = body.state;
      if (body.country !== undefined) updateData.country = body.country;
      if (body.isHeadquarters !== undefined) updateData.is_headquarters = body.isHeadquarters;
      if (body.isActive !== undefined) updateData.is_active = body.isActive;

      const [updated] = await uow.db
        .update(appOrganizationUnits)
        .set(updateData)
        .where(eq(appOrganizationUnits.id, unitId))
        .returning();

      return reply.status(200).send({
        code: 'SUCCESS',
        message: 'Organization unit updated successfully',
        data: toUnitResponse(updated),
      });
    }
  );

  // DELETE /api/v1/business/organization-units/:id
  app.delete<{ Params: { id: string } }>(
    '/api/v1/business/organization-units/:id',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.ADMIN)],
      schema: {
        tags: [ORGANIZATION_SWAGGER_TAG],
        summary: 'Deactivate / Soft Delete Organization Unit',
        security: SecurityBearer,
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
          ...StandardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      await uow.db
        .update(appOrganizationUnits)
        .set({ is_active: false, updated_at: new Date() })
        .where(eq(appOrganizationUnits.id, request.params.id));

      return reply.status(200).send({
        code: 'SUCCESS',
        message: 'Organization unit deactivated successfully',
      });
    }
  );

    // (Rooms routes are canonically handled by room.router.ts)
}
