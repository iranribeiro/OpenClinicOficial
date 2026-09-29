import type { FastifyInstance } from 'fastify';
import {
  type JwtConfig,
  UserRole,
  EntityNotFoundError,
} from '@openclinic/core';
import type { UnitOfWork } from '../../arch/infrastructure/database/uow.js';
import {
  appStaff,
  appStaffQualifications,
  appSpecialties,
} from '../../arch/infrastructure/database/drizzle-schema.js';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { createAuthenticateJwt } from '../../arch/presentation/middlewares/authenticate-jwt.js';
import { requireRole } from '../../arch/presentation/middlewares/require-permission.js';
import { SecurityBearer, StandardErrorResponses } from '../../arch/presentation/openapi.schemas.js';
import { randomUUID } from 'node:crypto';

export const STAFF_SWAGGER_TAG = 'Business & Registries: Staff';
export const SPECIALTY_SWAGGER_TAG = 'Business & Registries: Specialties';

export interface ApiStaffQualificationPayload {
  id?: string;
  qualificationType: string;
  title: string;
  issuingInstitution?: string;
  issueYear?: number;
  expiryDate?: string;
  certificateNumber?: string;
  verificationStatus?: string;
}

export interface ApiStaffPayload {
  id?: string;
  userId?: string;
  fullName: string;
  cpf: string;
  rg?: string;
  birthDate: string;
  gender?: string;
  staffType: string;
  department?: string;
  jobPosition?: string;
  contractType?: string;
  hireDate: string;
  terminationDate?: string;
  phone?: string;
  email: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  photoUrl?: string;
  isActive?: boolean;
  qualifications?: ApiStaffQualificationPayload[];
}

function toStaffResponse(
  row: typeof appStaff.$inferSelect,
  qualifications: (typeof appStaffQualifications.$inferSelect)[] = []
) {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    cpf: row.cpf,
    rg: row.rg ?? undefined,
    birthDate: row.birth_date,
    gender: row.gender ?? undefined,
    staffType: row.staff_type,
    department: row.department ?? undefined,
    jobPosition: row.job_position ?? undefined,
    contractType: row.contract_type ?? undefined,
    hireDate: row.hire_date,
    terminationDate: row.termination_date ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email,
    emergencyContactName: row.emergency_contact_name ?? undefined,
    emergencyContactPhone: row.emergency_contact_phone ?? undefined,
    street: row.street ?? undefined,
    number: row.number ?? undefined,
    complement: row.complement ?? undefined,
    neighborhood: row.neighborhood ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    postalCode: row.postal_code ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    isActive: Boolean(row.is_active),
    qualifications: qualifications.map((q) => ({
      id: q.id,
      qualificationType: q.qualification_type,
      title: q.title,
      issuingInstitution: q.issuing_institution ?? undefined,
      issueYear: q.year_issued ?? undefined,
      expiryDate: q.valid_until ?? undefined,
      verificationStatus: 'VERIFIED',
    })),
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
      const conditions = [isNull(appStaff.deleted_at)];
      if (tenantId) {
        conditions.push(eq(appStaff.tenant_id, tenantId));
      }

      const rows = await uow.db
        .select()
        .from(appStaff)
        .where(and(...conditions))
        .orderBy(asc(appStaff.full_name));

      const staffIds = rows.map((r) => r.id);
      let allQualifications: (typeof appStaffQualifications.$inferSelect)[] = [];
      if (staffIds.length > 0) {
        allQualifications = await uow.db
          .select()
          .from(appStaffQualifications);
      }

      return reply.status(200).send(
        rows.map((row) =>
          toStaffResponse(
            row,
            allQualifications.filter((q) => q.staff_id === row.id)
          )
        )
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
      const [row] = await uow.db
        .select()
        .from(appStaff)
        .where(and(eq(appStaff.id, request.params.id), isNull(appStaff.deleted_at)))
        .limit(1);

      if (!row) {
        throw new EntityNotFoundError('Staff', request.params.id);
      }

      const qualifications = await uow.db
        .select()
        .from(appStaffQualifications)
        .where(eq(appStaffQualifications.staff_id, row.id));

      return reply.status(200).send(toStaffResponse(row, qualifications));
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
        security: SecurityBearer,
        body: {
          type: 'object',
          required: ['fullName', 'cpf', 'birthDate', 'staffType', 'hireDate', 'email'],
          properties: {
            fullName: { type: 'string' },
            cpf: { type: 'string' },
            birthDate: { type: 'string' },
            staffType: { type: 'string' },
            hireDate: { type: 'string' },
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
      const user = request.user!;
      const tenantId = user.tenant_id ?? 'ee720158-6f98-42c3-b371-3d216d7f421a';
      const staffId = body.id || `staff-${randomUUID().slice(0, 8)}`;
      const assignedUserId = body.userId || user.sub;

      const [insertedStaff] = await uow.db
        .insert(appStaff)
        .values({
          id: staffId,
          tenant_id: tenantId,
          user_id: assignedUserId,
          full_name: body.fullName,
          cpf: body.cpf,
          rg: body.rg || null,
          birth_date: body.birthDate,
          gender: body.gender || null,
          staff_type: body.staffType,
          department: body.department || null,
          job_position: body.jobPosition || null,
          contract_type: body.contractType || null,
          hire_date: body.hireDate,
          termination_date: body.terminationDate || null,
          phone: body.phone || null,
          email: body.email,
          emergency_contact_name: body.emergencyContactName || null,
          emergency_contact_phone: body.emergencyContactPhone || null,
          street: body.street || null,
          number: body.number || null,
          complement: body.complement || null,
          neighborhood: body.neighborhood || null,
          city: body.city || null,
          state: body.state || null,
          postal_code: body.postalCode || null,
          photo_url: body.photoUrl || null,
          is_active: body.isActive ?? true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      if (body.qualifications && body.qualifications.length > 0) {
        for (const q of body.qualifications) {
          await uow.db.insert(appStaffQualifications).values({
            id: q.id || `qual-${randomUUID().slice(0, 8)}`,
            tenant_id: tenantId,
            staff_id: staffId,
            qualification_type: q.qualificationType,
            title: q.title,
            issuing_institution: q.issuingInstitution || null,
            year_issued: q.issueYear || null,
            valid_until: q.expiryDate || null,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      }

      const qualifications = await uow.db
        .select()
        .from(appStaffQualifications)
        .where(eq(appStaffQualifications.staff_id, staffId));

      return reply.status(201).send({
        code: 'SUCCESS',
        message: 'Staff member created successfully',
        data: toStaffResponse(insertedStaff, qualifications),
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

      const updateData: Record<string, unknown> = { updated_at: new Date() };
      if (body.fullName !== undefined) updateData.full_name = body.fullName;
      if (body.cpf !== undefined) updateData.cpf = body.cpf;
      if (body.rg !== undefined) updateData.rg = body.rg;
      if (body.birthDate !== undefined) updateData.birth_date = body.birthDate;
      if (body.gender !== undefined) updateData.gender = body.gender;
      if (body.staffType !== undefined) updateData.staff_type = body.staffType;
      if (body.department !== undefined) updateData.department = body.department;
      if (body.jobPosition !== undefined) updateData.job_position = body.jobPosition;
      if (body.contractType !== undefined) updateData.contract_type = body.contractType;
      if (body.hireDate !== undefined) updateData.hire_date = body.hireDate;
      if (body.terminationDate !== undefined) updateData.termination_date = body.terminationDate;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.email !== undefined) updateData.email = body.email;
      if (body.emergencyContactName !== undefined) updateData.emergency_contact_name = body.emergencyContactName;
      if (body.emergencyContactPhone !== undefined) updateData.emergency_contact_phone = body.emergencyContactPhone;
      if (body.street !== undefined) updateData.street = body.street;
      if (body.number !== undefined) updateData.number = body.number;
      if (body.complement !== undefined) updateData.complement = body.complement;
      if (body.neighborhood !== undefined) updateData.neighborhood = body.neighborhood;
      if (body.city !== undefined) updateData.city = body.city;
      if (body.state !== undefined) updateData.state = body.state;
      if (body.postalCode !== undefined) updateData.postal_code = body.postalCode;
      if (body.photoUrl !== undefined) updateData.photo_url = body.photoUrl;
      if (body.isActive !== undefined) updateData.is_active = body.isActive;

      const [updatedStaff] = await uow.db
        .update(appStaff)
        .set(updateData)
        .where(eq(appStaff.id, staffId))
        .returning();

      if (!updatedStaff) {
        throw new EntityNotFoundError('Staff', staffId);
      }

      const qualifications = await uow.db
        .select()
        .from(appStaffQualifications)
        .where(eq(appStaffQualifications.staff_id, staffId));

      return reply.status(200).send({
        code: 'SUCCESS',
        message: 'Staff member updated successfully',
        data: toStaffResponse(updatedStaff, qualifications),
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
      await uow.db
        .update(appStaff)
        .set({ is_active: false, deleted_at: new Date(), updated_at: new Date() })
        .where(eq(appStaff.id, request.params.id));

      return reply.status(200).send({
        code: 'SUCCESS',
        message: 'Staff member deactivated successfully',
      });
    }
  );
}
