-- Identity uniqueness is application-wide, not per-tenant.
--
-- Authentication resolves an account from the identifier alone -- email OR username OR CPF,
-- with no tenant in the request (see LoginUseCase and UserRepository.getByIdentifier). Two
-- accounts sharing an identifier would therefore make the resolution non-deterministic: the
-- lookup takes a single arbitrary row, so a legitimate holder can be told their password is
-- wrong while the counter for failed attempts climbs.
--
-- The indexes below replace the previous per-tenant composites, which also failed to constrain
-- platform accounts: a unique btree treats NULL as distinct, so every row with a NULL tenant_id
-- (the OWNER and other platform-wide accounts) was exempt from the constraint entirely.
--
-- Two properties are deliberate:
--   * Case-insensitivity for email and username, because every read path lowercases its input.
--     A case variant would otherwise be a second account answering to the same identifier.
--   * Partial on deleted_at IS NULL, so a soft-deleted account releases its identifier instead
--     of blocking it forever -- which would also prevent re-registering a data subject.
--
-- Inspect conflicts before applying with:
--   SELECT lower(email)    FROM iam_users WHERE deleted_at IS NULL GROUP BY 1 HAVING count(*) > 1;
--   SELECT lower(username) FROM iam_users WHERE deleted_at IS NULL GROUP BY 1 HAVING count(*) > 1;
--   SELECT cpf             FROM iam_users WHERE deleted_at IS NULL AND cpf IS NOT NULL GROUP BY 1 HAVING count(*) > 1;

DO $$
DECLARE conflicts integer;
BEGIN
  SELECT count(*) INTO conflicts FROM (
    SELECT lower(email) FROM iam_users WHERE deleted_at IS NULL GROUP BY 1 HAVING count(*) > 1
  ) duplicated;
  IF conflicts > 0 THEN
    RAISE EXCEPTION 'Refusing to enforce global email uniqueness: % value(s) are shared by more than one active account.', conflicts;
  END IF;

  SELECT count(*) INTO conflicts FROM (
    SELECT lower(username) FROM iam_users WHERE deleted_at IS NULL GROUP BY 1 HAVING count(*) > 1
  ) duplicated;
  IF conflicts > 0 THEN
    RAISE EXCEPTION 'Refusing to enforce global username uniqueness: % value(s) are shared by more than one active account.', conflicts;
  END IF;

  SELECT count(*) INTO conflicts FROM (
    SELECT cpf FROM iam_users WHERE deleted_at IS NULL AND cpf IS NOT NULL GROUP BY 1 HAVING count(*) > 1
  ) duplicated;
  IF conflicts > 0 THEN
    RAISE EXCEPTION 'Refusing to enforce global CPF uniqueness: % value(s) are shared by more than one active account.', conflicts;
  END IF;
END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_iam_users_email_tenant";
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_iam_users_username_tenant";
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_iam_users_cpf";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_iam_users_email_global" ON "iam_users" USING btree (lower("email")) WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_iam_users_username_global" ON "iam_users" USING btree (lower("username")) WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_iam_users_cpf_global" ON "iam_users" USING btree ("cpf") WHERE "deleted_at" IS NULL AND "cpf" IS NOT NULL;
--> statement-breakpoint
-- The functional indexes above cannot answer an exact-match lookup on the raw column, and the
-- username path (isUsernameTaken, walked once per candidate while suggesting a name) needs one.
CREATE INDEX IF NOT EXISTS "idx_iam_users_username_lookup" ON "iam_users" USING btree ("username");
