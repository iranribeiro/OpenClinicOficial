import type { FastifyInstance } from 'fastify';
import {
  type JwtConfig,
  Cpf,
  Email,
  ErrorCode,
  UserRole,
  EntityNotFoundError,
  ValidationError,
} from '@openclinic/core';
import type { UnitOfWork } from '../../arch/infrastructure/database/uow.js';
import {
  appOrganizationUnits,
  appSpecialties,
  appStaff,
  appStaffQualifications,
  appStaffUnits,
  iamUsers,
} from '../../arch/infrastructure/database/drizzle-schema.js';
import { eq, and, inArray, isNull, asc } from 'drizzle-orm';
import { createAuthenticateJwt } from '../../arch/presentation/middlewares/authenticate-jwt.js';
import { requireRole } from '../../arch/presentation/middlewares/require-permission.js';
import { SecurityBearer, StandardErrorResponses } from '../../arch/presentation/openapi.schemas.js';
import { randomUUID } from 'node:crypto';
import { linkSystemUser } from '../../arch/application/services/system-user-link.service.js';

export const STAFF_SWAGGER_TAG = 'Business & Registries: Staff';
export const SPECIALTY_SWAGGER_TAG = 'Business & Registries: Specialties';

export interface ApiStaffQualificationPayload {
  qualification_type: string;
  title: string;
  issuing_institution?: string | null;
  year_issued?: number | null;
  valid_until?: string | null;
}

export interface ApiStaffPayload {
  full_name: string;
  cpf: string;
  rg?: string;
  birth_date: string;
  gender?: string;
  staff_type: string;
  department?: string;
  job_position?: string;
  contract_type?: string;
  hire_date: string;
  termination_date?: string;
  phone?: string;
  email: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  photo_url?: string;
  is_active?: boolean;
  /** Login account linked to this collaborator. Created when absent, refreshed when present. */
  username?: string;
  login_password?: string;
  qualifications?: ApiStaffQualificationPayload[];
  /** Organization units the collaborator works at. Supplying the list replaces it wholesale. */
  units?: string[];
}

const staffColumns = [
  'full_name', 'cpf', 'rg', 'birth_date', 'gender', 'staff_type', 'department', 'job_position',
  'contract_type', 'hire_date', 'termination_date', 'phone', 'email', 'emergency_contact_name',
  'emergency_contact_phone', 'street', 'number', 'complement', 'neighborhood', 'city', 'state',
  'postal_code', 'photo_url', 'is_active',
] as const;

function toStaffResponse(
  row: typeof appStaff.$inferSelect,
  qualifications: (typeof appStaffQualifications.$inferSelect)[] = [],
  unitIds: string[] = [],
  username?: string,
) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    username,
    full_name: row.full_name,
    cpf: row.cpf,
    rg: row.rg ?? undefined,
    birth_date: row.birth_date,
    gender: row.gender ?? undefined,
    staff_type: row.staff_type,
    department: row.department ?? undefined,
    job_position: row.job_position ?? undefined,
    contract_type: row.contract_type ?? undefined,
    hire_date: row.hire_date,
    termination_date: row.termination_date ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email,
    emergency_contact_name: row.emergency_contact_name ?? undefined,
    emergency_contact_phone: row.emergency_contact_phone ?? undefined,
    street: row.street ?? undefined,
    number: row.number ?? undefined,
    complement: row.complement ?? undefined,
    neighborhood: row.neighborhood ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    postal_code: row.postal_code ?? undefined,
    photo_url: row.photo_url ?? undefined,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
    qualifications: qualifications.map((q) => ({
      id: q.id,
      qualification_type: q.qualification_type,
      title: q.title,
      issuing_institution: q.issuing_institution ?? undefined,
      year_issued: q.year_issued ?? undefined,
      valid_until: q.valid_until ?? undefined,
    })),
    units: unitIds,
  };
}

/** Replaces the child collections of a staff member inside an open transaction. */
async function replaceChildren(
  db: Parameters<Parameters<UnitOfWork['db']['transaction']>[0]>[0],
  tenantId: string,
  staffId: string,
  body: Partial<ApiStaffPayload>,
): Promise<void> {
  if (body.qualifications) {
    await db.delete(appStaffQualifications).where(eq(appStaffQualifications.staff_id, staffId));
    const rows = body.qualifications.filter((q) => q.qualification_type?.trim() && q.title?.trim());
    if (rows.length) {
      await db.insert(appStaffQualifications).values(rows.map((q) => ({
        id: randomUUID(),
        tenant_id: tenantId,
        staff_id: staffId,
        qualification_type: q.qualification_type,
        title: q.title,
        issuing_institution: q.issuing_institution || null,
        year_issued: q.year_issued ?? null,
        valid_until: q.valid_until || null,
        is_active: true,
      })));
    }
  }

  if (body.units) {
    const unitIds = [...new Set(body.units)];
    if (unitIds.length) {
      const units = await db.select({ id: appOrganizationUnits.id }).from(appOrganizationUnits)
        .where(and(eq(appOrganizationUnits.tenant_id, tenantId), inArray(appOrganizationUnits.id, unitIds),
          eq(appOrganizationUnits.is_active, true), isNull(appOrganizationUnits.deleted_at))).for('share');
      const known = new Set(units.map((unit) => unit.id));
      for (const unitId of unitIds) {
        if (!known.has(unitId)) {
          throw new ValidationError('units', ErrorCode.VALIDATION_ERROR, { organization_unit_id: unitId });
        }
      }
    }
    await db.delete(appStaffUnits).where(eq(appStaffUnits.staff_id, staffId));
    if (unitIds.length) {
      await db.insert(appStaffUnits).values(unitIds.map((unitId) => ({
        id: randomUUID(),
        tenant_id: tenantId,
        staff_id: staffId,
        organization_unit_id: unitId,
      })));
    }
  }
}

/** Reads qualifications, units and login names for a page of staff members. */
async function readChildren(uow: UnitOfWork, rows: (typeof appStaff.$inferSelect)[]) {
  const ids = rows.map((row) => row.id);
  const userIds = rows.map((row) => row.user_id).filter((id): id is string => Boolean(id));
  const [qualifications, units, users] = await Promise.all([
    ids.length ? uow.db.select().from(appStaffQualifications).where(inArray(appStaffQualifications.staff_id, ids)) : [],
    ids.length ? uow.db.select().from(appStaffUnits).where(inArray(appStaffUnits.staff_id, ids)) : [],
    userIds.length ? uow.db.select({ id: iamUsers.id, username: iamUsers.username }).from(iamUsers).where(inArray(iamUsers.id, userIds)) : [],
  ]);
  const usernames = new Map(users.map((user) => [user.id, user.username]));
  return {
    qualificationsFor: (staffId: string) => qualifications.filter((q) => q.staff_id === staffId),
    unitsFor: (staffId: string) => units.filter((u) => u.staff_id === staffId).map((u) => u.organization_unit_id),
    usernameFor: (userId: string) => usernames.get(userId),
  };
}

export function registerStaffRoutes(
  app: FastifyInstance,
  uow: UnitOfWork,
  jwtConfig: JwtConfig
): void {
  const authenticateJwt = createAuthenticateJwt(jwtConfig, uow);

  // ── SPECIALTIES ────────────────────────────────────────────────────────────

  // GET /api/v1/business/specialties
  app.get(
    '/api/v1/business/specialties',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.USER)],
      schema: {
        tags: [SPECIALTY_SWAGGER_TAG],
        summary: 'List Medical Specialties',
        description: 'Returns all active standardized medical specialties (CBO/FHIR catalog).',
        security: SecurityBearer,
        response: {
          200: {
            description: 'List of specialties',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                code: { type: 'string' },
                name: { type: 'string' },
                nameEn: { type: 'string' },
                cboCode: { type: 'string' },
                fhirCode: { type: 'string' },
                isActive: { type: 'boolean' },
              },
            },
          },
          ...StandardErrorResponses,
        },
      },
    },
    async (_request, reply) => {
      const rows = await uow.db
        .select()
        .from(appSpecialties)
        .where(eq(appSpecialties.is_active, true))
        .orderBy(asc(appSpecialties.name));

      return reply.status(200).send(
        rows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          nameEn: r.name_en ?? undefined,
          cboCode: r.cbo_code ?? undefined,
          fhirCode: r.fhir_code ?? undefined,
          isActive: Boolean(r.is_active),
        }))
      );
    }
  );

  // ── STAFF ──────────────────────────────────────────────────────────────────

  // GET /api/v1/business/staff
  app.get(
    '/api/v1/business/staff',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.USER)],
      schema: {
        tags: [STAFF_SWAGGER_TAG],
        summary: 'List Staff Members',
        description: 'Returns all non-deleted administrative and auxiliary staff for the current tenant.',
        security: SecurityBearer,
        response: {
          200: {
            description: 'List of staff members',
            type: 'array',
            items: { type: 'object', additionalProperties: true },
          },
          ...StandardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      const tenantId = request.user?.tenant_id;
      if (!tenantId) throw new ValidationError('tenant', ErrorCode.FORBIDDEN);

      const rows = await uow.db
        .select()
        .from(appStaff)
        .where(and(eq(appStaff.tenant_id, tenantId), isNull(appStaff.deleted_at)))
        .orderBy(asc(appStaff.full_name));

      const children = await readChildren(uow, rows);

      return reply.status(200).send(
        rows.map((row) => toStaffResponse(
          row,
          children.qualificationsFor(row.id),
          children.unitsFor(row.id),
          children.usernameFor(row.user_id),
        ))
      );
    }
  );

  // GET /api/v1/business/staff/:id
  app.get<{ Params: { id: string } }>(
    '/api/v1/business/staff/:id',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.USER)],
      schema: {
        tags: [STAFF_SWAGGER_TAG],
        summary: 'Get Staff Member by ID',
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
      const tenantId = request.user?.tenant_id;
      if (!tenantId) throw new ValidationError('tenant', ErrorCode.FORBIDDEN);

      const [row] = await uow.db
        .select()
        .from(appStaff)
        .where(and(eq(appStaff.id, request.params.id), eq(appStaff.tenant_id, tenantId), isNull(appStaff.deleted_at)))
        .limit(1);

      if (!row) {
        throw new EntityNotFoundError('Staff', request.params.id);
      }

      const children = await readChildren(uow, [row]);
      return reply.status(200).send(toStaffResponse(
        row,
        children.qualificationsFor(row.id),
        children.unitsFor(row.id),
        children.usernameFor(row.user_id),
      ));
    }
  );

  // POST /api/v1/business/staff
  app.post<{ Body: ApiStaffPayload }>(
    '/api/v1/business/staff',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.ADMIN)],
      schema: {
        tags: [STAFF_SWAGGER_TAG],
        summary: 'Create Staff Member',
        description: 'Creates the collaborator, its qualifications, its units and its system account in one transaction.',
        security: SecurityBearer,
        body: {
          type: 'object',
          required: ['full_name', 'cpf', 'birth_date', 'staff_type', 'hire_date', 'email'],
          properties: {
            full_name: { type: 'string' },
            cpf: { type: 'string' },
            birth_date: { type: 'string' },
            staff_type: { type: 'string' },
            hire_date: { type: 'string' },
            email: { type: 'string' },
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
      const tenantId = request.user!.tenant_id;
      if (!tenantId) throw new ValidationError('tenant', ErrorCode.FORBIDDEN);

      const cpf = Cpf.clean(body.cpf);
      if (!Cpf.isValid(cpf)) throw new ValidationError('cpf', ErrorCode.VALIDATION_ERROR);
      const email = Email.create(body.email.trim().toLowerCase()).toString();

      const created = await uow.db.transaction(async (tx) => {
        const staffId = randomUUID();

        // The login is created in the same transaction as the person record, so a rejected
        // cadastro never leaves an orphan account behind.
        const linked = await linkSystemUser(uow.forTransaction(tx), {
          tenant_id: tenantId,
          full_name: body.full_name.trim(),
          email,
          cpf,
          username: body.username,
          password: body.login_password,
          job_title: body.job_position,
        });

        const [row] = await tx.insert(appStaff).values({
          id: staffId,
          tenant_id: tenantId,
          user_id: linked.user_id,
          full_name: body.full_name.trim(),
          cpf,
          rg: body.rg || null,
          birth_date: body.birth_date,
          gender: body.gender || null,
          staff_type: body.staff_type,
          department: body.department || null,
          job_position: body.job_position || null,
          contract_type: body.contract_type || null,
          hire_date: body.hire_date,
          termination_date: body.termination_date || null,
          phone: body.phone || null,
          email,
          emergency_contact_name: body.emergency_contact_name || null,
          emergency_contact_phone: body.emergency_contact_phone || null,
          street: body.street || null,
          number: body.number || null,
          complement: body.complement || null,
          neighborhood: body.neighborhood || null,
          city: body.city || null,
          state: body.state || null,
          postal_code: body.postal_code || null,
          photo_url: body.photo_url || null,
          is_active: body.is_active ?? true,
        }).returning();

        await replaceChildren(tx, tenantId, staffId, body);
        return { row: row!, username: linked.username };
      });

      const children = await readChildren(uow, [created.row]);
      return reply.status(201).send({
        code: 'SUCCESS',
        message: 'Staff member created successfully',
        data: toStaffResponse(created.row, children.qualificationsFor(created.row.id),
          children.unitsFor(created.row.id), created.username),
      });
    }
  );

  // PUT /api/v1/business/staff/:id
  app.put<{ Params: { id: string }; Body: Partial<ApiStaffPayload> }>(
    '/api/v1/business/staff/:id',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.ADMIN)],
      schema: {
        tags: [STAFF_SWAGGER_TAG],
        summary: 'Update Staff Member',
        description: 'Updates supplied fields, replacing any supplied qualification or unit list and refreshing the linked system account.',
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
      const staffId = request.params.id;
      const tenantId = request.user!.tenant_id;
      if (!tenantId) throw new ValidationError('tenant', ErrorCode.FORBIDDEN);

      const updated = await uow.db.transaction(async (tx) => {
        const [current] = await tx.select().from(appStaff)
          .where(and(eq(appStaff.id, staffId), eq(appStaff.tenant_id, tenantId), isNull(appStaff.deleted_at)))
          .limit(1).for('update');
        if (!current) return null;

        const cpf = body.cpf === undefined ? current.cpf : Cpf.clean(body.cpf);
        if (!Cpf.isValid(cpf)) throw new ValidationError('cpf', ErrorCode.VALIDATION_ERROR);
        const email = body.email === undefined ? current.email : Email.create(body.email.trim().toLowerCase()).toString();

        const linked = await linkSystemUser(uow.forTransaction(tx), {
          tenant_id: tenantId,
          user_id: current.user_id,
          full_name: body.full_name ?? current.full_name,
          email,
          cpf,
          username: body.username,
          password: body.login_password,
          job_title: body.job_position ?? current.job_position,
        });

        const updateData: Record<string, unknown> = { updated_at: new Date(), user_id: linked.user_id };
        for (const column of staffColumns) {
          const value = body[column];
          if (value !== undefined) updateData[column] = value;
        }
        updateData.cpf = cpf;
        updateData.email = email;
        if (typeof updateData.full_name === 'string') updateData.full_name = updateData.full_name.trim();

        const [row] = await tx.update(appStaff)
          .set(updateData as Partial<typeof appStaff.$inferInsert>)
          .where(and(eq(appStaff.id, staffId), eq(appStaff.tenant_id, tenantId)))
          .returning();

        await replaceChildren(tx, tenantId, staffId, body);
        return { row: row!, username: linked.username };
      });

      if (!updated) throw new EntityNotFoundError('Staff', staffId);

      const children = await readChildren(uow, [updated.row]);
      return reply.status(200).send({
        code: 'SUCCESS',
        message: 'Staff member updated successfully',
        data: toStaffResponse(updated.row, children.qualificationsFor(updated.row.id),
          children.unitsFor(updated.row.id), updated.username),
      });
    }
  );

  // DELETE /api/v1/business/staff/:id
  app.delete<{ Params: { id: string } }>(
    '/api/v1/business/staff/:id',
    {
      preHandler: [authenticateJwt, requireRole(UserRole.ADMIN)],
      schema: {
        tags: [STAFF_SWAGGER_TAG],
        summary: 'Deactivate / Soft Delete Staff Member',
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
      const tenantId = request.user!.tenant_id;
      if (!tenantId) throw new ValidationError('tenant', ErrorCode.FORBIDDEN);

      const now = new Date();
      const deactivated = await uow.db.transaction(async (tx) => {
        const rows = await tx.update(appStaff)
          .set({ is_active: false, deleted_at: now, updated_at: now })
          .where(and(eq(appStaff.id, request.params.id), eq(appStaff.tenant_id, tenantId)))
          .returning();
        if (!rows.length) return false;
        await tx.update(appStaffQualifications).set({ is_active: false, updated_at: now })
          .where(eq(appStaffQualifications.staff_id, request.params.id));
        return true;
      });

      if (!deactivated) throw new EntityNotFoundError('Staff', request.params.id);

      return reply.status(200).send({
        code: 'SUCCESS',
        message: 'Staff member deactivated successfully',
      });
    }
  );
}
