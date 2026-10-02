import { eq, or, and, isNull, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { randomUUID } from 'node:crypto';
import { ErrorCode, Username, ValidationError } from '@openclinic/core';
import { iamUsers } from './drizzle-schema.js';
import type { IUserRepository } from '../../domain/repositories.js';
import type { UserEntity } from '../../domain/entities.js';

/**
 * Enforces the username shape on the way into the table, so the rule does not depend on every
 * route remembering to validate it. Delegates to the value object, which is the same definition
 * the request schemas call, so there is one rule rather than two that can drift apart.
 *
 * A username that starts with a digit is what this guards against: `getByIdentifier` resolves an
 * account by `email OR username OR cpf`, so an all-digit username would shadow somebody's CPF.
 */
function assertUsernameShape(username: unknown): void {
  if (username === undefined || username === null) return;
  if (typeof username !== 'string' || !Username.isValid(username)) {
    throw new ValidationError('username', ErrorCode.VALIDATION_ERROR);
  }
}

export class UserRepository implements IUserRepository {
  constructor(private db: PostgresJsDatabase) {}

  async create(entity: Partial<UserEntity>): Promise<UserEntity> {
    assertUsernameShape(entity.username);
    const id = entity.id || randomUUID();
    const [user] = await this.db.insert(iamUsers).values({ ...entity, id } as typeof iamUsers.$inferInsert).returning();
    return user as unknown as UserEntity;
  }

  async getById(id: string): Promise<UserEntity | null> {
    const [user] = await this.db
      .select()
      .from(iamUsers)
      .where(and(eq(iamUsers.id, id), isNull(iamUsers.deleted_at)))
      .limit(1);
    return (user as unknown as UserEntity) ?? null;
  }

  /**
   * Resolves an account from the identifier alone, the way authentication asks for it. Email and
   * username are compared case-insensitively to match the uniqueness indexes on the same
   * expressions, so an account stored in mixed case is still reachable instead of unresolvable.
   */
  async getByIdentifier(identifier: string): Promise<UserEntity | null> {
    const cleanDigits = identifier.replace(/\D/g, '');
    const canonical = identifier.toLowerCase();
    const orConditions = [
      sql`lower(${iamUsers.email}) = ${canonical}`,
      sql`lower(${iamUsers.username}) = ${canonical}`,
    ];
    if (cleanDigits.length === 11) {
      orConditions.push(eq(iamUsers.cpf, cleanDigits));
    }

    const [user] = await this.db
      .select()
      .from(iamUsers)
      .where(
        and(
          or(...orConditions),
          isNull(iamUsers.deleted_at)
        )
      )
      .limit(1);
    return (user as unknown as UserEntity) ?? null;
  }

  async getByEmail(email: string, tenantId?: string): Promise<UserEntity | null> {
    // Case-insensitive to match idx_iam_users_email_global, so the casing a caller happens to send
    // cannot decide whether an existing account is seen.
    const matchesEmail = sql`lower(${iamUsers.email}) = ${email.trim().toLowerCase()}`;
    const conditions = tenantId
      ? and(
          matchesEmail,
          or(eq(iamUsers.tenant_id, tenantId), isNull(iamUsers.tenant_id)),
          isNull(iamUsers.deleted_at)
        )
      : and(matchesEmail, isNull(iamUsers.deleted_at));
    const [user] = await this.db.select().from(iamUsers).where(conditions).limit(1);
    return (user as unknown as UserEntity) ?? null;
  }

  async listAll(skip = 0, limit = 100): Promise<UserEntity[]> {
    const users = await this.db
      .select()
      .from(iamUsers)
      .where(isNull(iamUsers.deleted_at))
      .offset(skip)
      .limit(limit);
    return users as unknown as UserEntity[];
  }

  async update(id: string, entity: Partial<UserEntity>): Promise<UserEntity> {
    assertUsernameShape(entity.username);
    const [updated] = await this.db
      .update(iamUsers)
      .set({ ...entity, updated_at: new Date() } as typeof iamUsers.$inferInsert)
      .where(and(eq(iamUsers.id, id), isNull(iamUsers.deleted_at)))
      .returning();
    return updated as unknown as UserEntity;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .update(iamUsers)
      .set({ is_active: false, deleted_at: new Date(), updated_at: new Date() })
      .where(and(eq(iamUsers.id, id), isNull(iamUsers.deleted_at)))
      .returning();
    return result.length > 0;
  }

  async getByField(fieldName: string, value: unknown): Promise<UserEntity | null> {
    const col = (iamUsers as unknown as Record<string, unknown>)[fieldName];
    if (!col) return null;
    const [user] = await this.db
      .select()
      .from(iamUsers)
      .where(and(eq(col as typeof iamUsers.id, value as string), isNull(iamUsers.deleted_at)))
      .limit(1);
    return (user as unknown as UserEntity) ?? null;
  }

  async listByField(fieldName: string, value: unknown): Promise<UserEntity[]> {
    const col = (iamUsers as unknown as Record<string, unknown>)[fieldName];
    if (!col) return [];
    const users = await this.db
      .select()
      .from(iamUsers)
      .where(and(eq(col as typeof iamUsers.id, value as string), isNull(iamUsers.deleted_at)));
    return users as unknown as UserEntity[];
  }
}
