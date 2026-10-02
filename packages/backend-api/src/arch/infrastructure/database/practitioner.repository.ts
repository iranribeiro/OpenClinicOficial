import { randomUUID } from 'node:crypto';
import { CouncilRegistration, ErrorCode, ValidationError } from '@openclinic/core';
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  COUNCIL_PRACTITIONER_TYPE,
  primaryOf,
  type Practitioner,
  type PractitionerAvailability,
  type PractitionerCollections,
  type PractitionerInput,
  type PractitionerQualification,
  type PractitionerRegistration,
  type PractitionerRepository,
  type PractitionerSpecialty,
} from '../../domain/practitioner.js';
import { linkSystemUser } from '../../application/services/system-user-link.service.js';
import type { UnitOfWork } from './uow.js';
import {
  appOrganizationUnits,
  appPractitionerAvailability,
  appPractitionerQualifications,
  appPractitionerRegistrations,
  appPractitionerSpecialties,
  appPractitioners,
  appRooms,
  appSpecialties,
  iamUsers,
} from './drizzle-schema.js';

/** The query surface shared by the pool and an open transaction. */
type Queryable = Pick<PostgresJsDatabase, 'select' | 'insert' | 'update' | 'delete'>;

type PractitionerRow = typeof appPractitioners.$inferSelect;
type RegistrationRow = typeof appPractitionerRegistrations.$inferSelect;
type SpecialtyRow = typeof appPractitionerSpecialties.$inferSelect;
type QualificationRow = typeof appPractitionerQualifications.$inferSelect;
type AvailabilityRow = typeof appPractitionerAvailability.$inferSelect;

/** Parent columns a caller may write. Everything else on the row is server-managed. */
const PARENT_COLUMNS = [
  'full_name', 'practitioner_type', 'job_title', 'council_type', 'council_number', 'council_uf',
  'primary_specialty', 'is_clinical_staff', 'cpf', 'email', 'phone', 'birth_date', 'gender',
  'social_name', 'cns', 'photo_url', 'street', 'number', 'complement', 'neighborhood', 'city',
  'state', 'postal_code', 'is_technical_lead', 'digital_signature_type', 'calendar_color', 'notes',
] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const toRegistration = (row: RegistrationRow): PractitionerRegistration => ({
  id: row.id,
  registration_type: row.registration_type,
  registration_number: row.registration_number,
  registration_state: row.registration_state ?? null,
  is_primary: row.is_primary,
  issuing_body: row.issuing_body ?? null,
  issue_date: row.issue_date ?? null,
  expiration_date: row.expiration_date ?? null,
  status: row.status,
  verification_url: row.verification_url ?? null,
});

const toSpecialty = (row: SpecialtyRow): PractitionerSpecialty => ({
  id: row.id,
  specialty_id: row.specialty_id,
  is_primary: row.is_primary,
  qualification_date: row.qualification_date ?? null,
  rqe_number: row.rqe_number ?? null,
});

const toQualification = (row: QualificationRow): PractitionerQualification => ({
  id: row.id,
  qualification_type: row.qualification_type,
  issuing_institution: row.issuing_institution,
  degree_name: row.degree_name,
  year_issued: row.year_issued,
  country_code: row.country_code ?? null,
  valid_until: row.valid_until ?? null,
  document_url: row.document_url ?? null,
});

const toAvailability = (row: AvailabilityRow): PractitionerAvailability => ({
  id: row.id,
  organization_unit_id: row.organization_unit_id ?? null,
  day_of_week: row.day_of_week,
  start_time: row.start_time,
  end_time: row.end_time,
  lunch_start: row.lunch_start ?? null,
  lunch_end: row.lunch_end ?? null,
  slot_duration_minutes: row.slot_duration_minutes,
  room_id: row.room_id ?? null,
});

interface Collections {
  registrations: PractitionerRegistration[];
  specialties: PractitionerSpecialty[];
  qualifications: PractitionerQualification[];
  availability: PractitionerAvailability[];
}

const emptyCollections = (): Collections => ({ registrations: [], specialties: [], qualifications: [], availability: [] });

export class PostgresPractitionerRepository implements PractitionerRepository {
  constructor(
    private readonly db: PostgresJsDatabase,
    private readonly tenantId: string,
    private readonly uow: UnitOfWork,
  ) {
    if (!tenantId) throw new Error('Practitioner repository requires a tenant');
  }

  private scope(id?: string) {
    return and(eq(appPractitioners.tenant_id, this.tenantId), isNull(appPractitioners.deleted_at),
      id === undefined ? undefined : eq(appPractitioners.id, id));
  }

  /**
   * Resolves login names for a page of accounts. Takes the query handle rather than using the
   * pool, because inside a transaction the login just created is only visible on that
   * connection — reading it from `this.db` would return nothing.
   */
  private async usernamesFor(db: Queryable, userIds: (string | null)[]): Promise<Map<string, string>> {
    const ids = userIds.filter((id): id is string => id !== null);
    if (ids.length === 0) return new Map();
    const rows = await db.select({ id: iamUsers.id, username: iamUsers.username })
      .from(iamUsers).where(inArray(iamUsers.id, ids));
    return new Map(rows.map((row) => [row.id, row.username]));
  }

  /** Reads the four child collections for a page of practitioners with one query per table. */
  private async collectionsFor(db: Queryable, practitionerIds: string[]): Promise<Map<string, Collections>> {
    const grouped = new Map<string, Collections>();
    for (const id of practitionerIds) grouped.set(id, emptyCollections());
    if (practitionerIds.length === 0) return grouped;

    const [registrations, specialties, qualifications, availability] = await Promise.all([
      db.select().from(appPractitionerRegistrations).where(inArray(appPractitionerRegistrations.practitioner_id, practitionerIds))
        .orderBy(asc(appPractitionerRegistrations.is_primary), asc(appPractitionerRegistrations.registration_type), asc(appPractitionerRegistrations.id)),
      db.select().from(appPractitionerSpecialties).where(inArray(appPractitionerSpecialties.practitioner_id, practitionerIds))
        .orderBy(asc(appPractitionerSpecialties.is_primary), asc(appPractitionerSpecialties.id)),
      db.select().from(appPractitionerQualifications).where(inArray(appPractitionerQualifications.practitioner_id, practitionerIds))
        .orderBy(asc(appPractitionerQualifications.year_issued), asc(appPractitionerQualifications.id)),
      db.select().from(appPractitionerAvailability).where(inArray(appPractitionerAvailability.practitioner_id, practitionerIds))
        .orderBy(asc(appPractitionerAvailability.day_of_week), asc(appPractitionerAvailability.start_time), asc(appPractitionerAvailability.id)),
    ]);

    for (const row of registrations) grouped.get(row.practitioner_id)?.registrations.push(toRegistration(row));
    for (const row of specialties) grouped.get(row.practitioner_id)?.specialties.push(toSpecialty(row));
    for (const row of qualifications) grouped.get(row.practitioner_id)?.qualifications.push(toQualification(row));
    for (const row of availability) grouped.get(row.practitioner_id)?.availability.push(toAvailability(row));
    return grouped;
  }

  private hydrate(row: PractitionerRow, collections: Collections, username?: string): Practitioner {
    return {
      ...row,
      username,
      registrations: collections.registrations,
      specialties: collections.specialties,
      qualifications: collections.qualifications,
      availability: collections.availability,
    };
  }

  async list({ offset, limit }: { offset: number; limit: number }): Promise<{ items: Practitioner[]; total: number }> {
    const rows = await this.db.select().from(appPractitioners).where(this.scope())
      .orderBy(asc(appPractitioners.full_name), asc(appPractitioners.id)).offset(offset).limit(limit);
    const [result] = await this.db.select({ total: count() }).from(appPractitioners).where(this.scope());
    const [collections, usernames] = await Promise.all([
      this.collectionsFor(this.db, rows.map((row) => row.id)),
      this.usernamesFor(this.db, rows.map((row) => row.user_id)),
    ]);
    return {
      items: rows.map((row) => this.hydrate(row, collections.get(row.id) ?? emptyCollections(),
        row.user_id ? usernames.get(row.user_id) : undefined)),
      total: result.total,
    };
  }

  async getById(id: string): Promise<Practitioner | null> {
    const [row] = await this.db.select().from(appPractitioners).where(this.scope(id)).limit(1);
    if (!row) return null;
    const [collections, usernames] = await Promise.all([
      this.collectionsFor(this.db, [row.id]),
      this.usernamesFor(this.db, [row.user_id]),
    ]);
    return this.hydrate(row, collections.get(row.id) ?? emptyCollections(),
      row.user_id ? usernames.get(row.user_id) : undefined);
  }

  /**
   * Validates every cross-table reference and returns the primary specialty name, which the
   * flat `primary_specialty` column denormalizes.
   */
  private async validateCollections(db: Queryable, input: PractitionerCollections): Promise<string | undefined> {
    let primarySpecialtyName: string | undefined;

    if (input.specialties?.length) {
      const ids = [...new Set(input.specialties.map((item) => item.specialty_id))];
      const rows = await db.select({ id: appSpecialties.id, name: appSpecialties.name }).from(appSpecialties)
        .where(and(inArray(appSpecialties.id, ids), eq(appSpecialties.is_active, true)));
      const names = new Map(rows.map((row) => [row.id, row.name]));
      for (const item of input.specialties) {
        if (!names.has(item.specialty_id)) {
          throw new ValidationError('specialties', ErrorCode.VALIDATION_ERROR, { specialty_id: item.specialty_id });
        }
      }
      const primary = primaryOf(input.specialties);
      if (primary) primarySpecialtyName = names.get(primary.specialty_id);
    }

    if (input.registrations?.length) {
      for (const registration of input.registrations) {
        if (!CouncilRegistration.isValid({
          councilType: registration.registration_type,
          number: registration.registration_number,
          uf: registration.registration_state ?? '',
        })) {
          throw new ValidationError('registrations', ErrorCode.VALIDATION_ERROR, {
            registration_type: registration.registration_type,
            registration_number: registration.registration_number,
            registration_state: registration.registration_state ?? null,
          });
        }
      }
    }

    if (input.availability?.length) {
      for (const shift of input.availability) {
        if (!Number.isInteger(shift.day_of_week) || shift.day_of_week < 0 || shift.day_of_week > 6) {
          throw new ValidationError('availability', ErrorCode.VALIDATION_ERROR, { day_of_week: shift.day_of_week });
        }
        if (!TIME_PATTERN.test(shift.start_time) || !TIME_PATTERN.test(shift.end_time) || shift.start_time >= shift.end_time) {
          throw new ValidationError('availability', ErrorCode.VALIDATION_ERROR,
            { start_time: shift.start_time, end_time: shift.end_time });
        }
        if (shift.slot_duration_minutes !== undefined && shift.slot_duration_minutes < 1) {
          throw new ValidationError('availability', ErrorCode.VALIDATION_ERROR,
            { slot_duration_minutes: shift.slot_duration_minutes });
        }
      }

      const unitIds = [...new Set(input.availability.map((shift) => shift.organization_unit_id))];
      const units = await db.select({ id: appOrganizationUnits.id }).from(appOrganizationUnits)
        .where(and(eq(appOrganizationUnits.tenant_id, this.tenantId), inArray(appOrganizationUnits.id, unitIds),
          eq(appOrganizationUnits.is_active, true), isNull(appOrganizationUnits.deleted_at))).for('share');
      const knownUnits = new Set(units.map((unit) => unit.id));
      for (const unitId of unitIds) {
        if (!knownUnits.has(unitId)) {
          throw new ValidationError('availability', ErrorCode.VALIDATION_ERROR, { organization_unit_id: unitId });
        }
      }

      const roomIds = [...new Set(input.availability
        .map((shift) => shift.room_id)
        .filter((id): id is string => Boolean(id)))];
      if (roomIds.length) {
        const rooms = await db.select({ id: appRooms.id }).from(appRooms)
          .where(and(eq(appRooms.tenant_id, this.tenantId), inArray(appRooms.id, roomIds),
            eq(appRooms.is_active, true), isNull(appRooms.deleted_at))).for('share');
        const knownRooms = new Set(rooms.map((room) => room.id));
        for (const roomId of roomIds) {
          if (!knownRooms.has(roomId)) {
            throw new ValidationError('availability', ErrorCode.VALIDATION_ERROR, { room_id: roomId });
          }
        }
      }
    }

    return primarySpecialtyName;
  }

  /**
   * Parent values for a write. The council and specialty collections own the denormalized
   * `practitioner_type` / `council_*` / `primary_specialty` columns, so those are re-derived
   * whenever the corresponding collection is supplied.
   */
  private parentValues(input: Partial<PractitionerInput>, primarySpecialtyName: string | undefined, isCreate: boolean) {
    const values: Record<string, unknown> = {};
    for (const column of PARENT_COLUMNS) {
      const value = input[column];
      if (value !== undefined) values[column] = value;
    }

    if (input.registrations) {
      const primary = primaryOf(input.registrations);
      values.practitioner_type = primary ? (COUNCIL_PRACTITIONER_TYPE[primary.registration_type] ?? 'OTHER') : 'OTHER';
      values.council_type = primary?.registration_type ?? null;
      values.council_number = primary ? CouncilRegistration.cleanNumber(primary.registration_number) : null;
      values.council_uf = primary?.registration_state ?? null;
    }
    // practitioner_type is NOT NULL, so creation needs a value even without a registration.
    if (isCreate && !values.practitioner_type) values.practitioner_type = 'OTHER';

    if (input.specialties) values.primary_specialty = primarySpecialtyName ?? null;
    return values;
  }

  /** Collections are replaced wholesale: the stored rows are dropped and re-inserted. */
  private async replaceCollections(db: Queryable, practitionerId: string, input: PractitionerCollections): Promise<void> {
    if (input.registrations) {
      await db.delete(appPractitionerRegistrations).where(eq(appPractitionerRegistrations.practitioner_id, practitionerId));
      if (input.registrations.length) {
        await db.insert(appPractitionerRegistrations).values(input.registrations.map((item) => ({
          id: randomUUID(),
          tenant_id: this.tenantId,
          practitioner_id: practitionerId,
          registration_type: item.registration_type,
          registration_number: CouncilRegistration.cleanNumber(item.registration_number),
          registration_state: item.registration_state ?? null,
          is_primary: item.is_primary ?? false,
          issuing_body: item.issuing_body ?? null,
          issue_date: item.issue_date ?? null,
          expiration_date: item.expiration_date ?? null,
          status: item.status ?? 'ACTIVE',
          verification_url: item.verification_url ?? null,
          is_active: true,
        })));
      }
    }

    if (input.specialties) {
      await db.delete(appPractitionerSpecialties).where(eq(appPractitionerSpecialties.practitioner_id, practitionerId));
      if (input.specialties.length) {
        await db.insert(appPractitionerSpecialties).values(input.specialties.map((item, index) => ({
          id: randomUUID(),
          tenant_id: this.tenantId,
          practitioner_id: practitionerId,
          specialty_id: item.specialty_id,
          is_primary: item.is_primary ?? index === 0,
          qualification_date: item.qualification_date ?? null,
          rqe_number: item.rqe_number ?? null,
          is_active: true,
        })));
      }
    }

    if (input.qualifications) {
      await db.delete(appPractitionerQualifications).where(eq(appPractitionerQualifications.practitioner_id, practitionerId));
      if (input.qualifications.length) {
        await db.insert(appPractitionerQualifications).values(input.qualifications.map((item) => ({
          id: randomUUID(),
          tenant_id: this.tenantId,
          practitioner_id: practitionerId,
          qualification_type: item.qualification_type,
          issuing_institution: item.issuing_institution,
          degree_name: item.degree_name,
          year_issued: item.year_issued,
          country_code: item.country_code ?? null,
          valid_until: item.valid_until ?? null,
          document_url: item.document_url ?? null,
          verified: false,
          is_active: true,
        })));
      }
    }

    if (input.availability) {
      await db.delete(appPractitionerAvailability).where(eq(appPractitionerAvailability.practitioner_id, practitionerId));
      if (input.availability.length) {
        await db.insert(appPractitionerAvailability).values(input.availability.map((shift) => ({
          id: randomUUID(),
          tenant_id: this.tenantId,
          practitioner_id: practitionerId,
          organization_unit_id: shift.organization_unit_id,
          day_of_week: shift.day_of_week,
          start_time: shift.start_time,
          end_time: shift.end_time,
          lunch_start: shift.lunch_start ?? null,
          lunch_end: shift.lunch_end ?? null,
          slot_duration_minutes: shift.slot_duration_minutes ?? 30,
          room_id: shift.room_id ?? null,
          is_active: true,
        })));
      }
    }
  }

  private async readBack(db: Queryable, id: string): Promise<Practitioner> {
    const [row] = await db.select().from(appPractitioners).where(this.scope(id)).limit(1);
    if (!row) throw new Error('Practitioner disappeared inside its own transaction');
    const [collections, usernames] = await Promise.all([
      this.collectionsFor(db, [row.id]),
      this.usernamesFor(db, [row.user_id]),
    ]);
    return this.hydrate(row, collections.get(row.id) ?? emptyCollections(),
      row.user_id ? usernames.get(row.user_id) : undefined);
  }

  async create(input: PractitionerInput): Promise<Practitioner> {
    return this.db.transaction(async (tx) => {
      const primarySpecialtyName = await this.validateCollections(tx, input);

      // The login is created in the same transaction as the person record, so a rejected
      // cadastro never leaves an orphan account behind.
      const linked = await linkSystemUser(this.uow.forTransaction(tx), {
        tenant_id: this.tenantId,
        full_name: input.full_name,
        email: input.email,
        cpf: input.cpf,
        username: input.username,
        password: input.login_password,
        job_title: input.job_title,
      });

      // parentValues is assembled column-by-column from a partial input, so its runtime shape
      // is only known to be a subset of the row.
      const [row] = await tx.insert(appPractitioners).values({
        ...this.parentValues(input, primarySpecialtyName, true),
        id: randomUUID(),
        tenant_id: this.tenantId,
        user_id: linked.user_id,
      } as typeof appPractitioners.$inferInsert).returning();

      await this.replaceCollections(tx, row.id, input);
      return this.readBack(tx, row.id);
    });
  }

  async update(id: string, input: Partial<PractitionerInput>): Promise<Practitioner | null> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(appPractitioners).where(this.scope(id)).limit(1).for('update');
      if (!current) return null;

      const primarySpecialtyName = await this.validateCollections(tx, input);

      const linked = await linkSystemUser(this.uow.forTransaction(tx), {
        tenant_id: this.tenantId,
        user_id: current.user_id,
        full_name: input.full_name ?? current.full_name,
        email: input.email ?? current.email,
        cpf: input.cpf === undefined ? current.cpf : input.cpf,
        username: input.username,
        password: input.login_password,
        job_title: input.job_title ?? current.job_title,
      });

      await tx.update(appPractitioners)
        .set({
          ...this.parentValues(input, primarySpecialtyName, false),
          user_id: linked.user_id,
          updated_at: new Date(),
        } as Partial<typeof appPractitioners.$inferInsert>)
        .where(this.scope(id));

      await this.replaceCollections(tx, id, input);
      return this.readBack(tx, id);
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const now = new Date();
      await tx.update(appPractitionerRegistrations).set({ is_active: false, updated_at: now })
        .where(eq(appPractitionerRegistrations.practitioner_id, id));
      await tx.update(appPractitionerSpecialties).set({ is_active: false, updated_at: now })
        .where(eq(appPractitionerSpecialties.practitioner_id, id));
      await tx.update(appPractitionerQualifications).set({ is_active: false, updated_at: now })
        .where(eq(appPractitionerQualifications.practitioner_id, id));
      await tx.update(appPractitionerAvailability).set({ is_active: false, updated_at: now })
        .where(eq(appPractitionerAvailability.practitioner_id, id));
      await tx.update(appPractitioners).set({ is_active: false, deleted_at: now, updated_at: now }).where(this.scope(id));
    });
  }
}
