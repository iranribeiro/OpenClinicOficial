# Local API validation

From the repository root, with dependencies installed and Docker Desktop running:

```bash
node infra/testing/run-local-validation.mjs
```

The runner starts a dedicated `postgres:17-alpine` container on a random loopback
port, builds core, and executes the existing backend, migration, and HTTP
functional suites. It enables the backup/restore test and limits backend workers
to two to reduce resource contention. It does not use the application database
or the running Swagger session. All business fixtures are synthetic.

Each run writes logs and `summary.json` under `.temp/validation/<run-id>/`.
The functional runner also writes its standard ignored reports under `artifacts/`.
Database clone tests may write ignored synthetic backup archives under `backups/`.
The dedicated container is removed on normal completion or a caught failure,
after its unique ownership label is checked. Forced termination can leave it
behind; identify it by the `openclinic-validation-` name and ownership label.

Exit code zero means every stage passed. A nonzero exit code requires inspection
of the summary: `specification-readiness` can fail for documented unimplemented
requirements even when all executable tests pass. This stage is never silently
waived. See `docs/agenda-testing.md` for coverage and known omissions.

This validates the implemented backend APIs, not every possible behavior or the
frontend UI. No application code, commits, or remote deployments are changed.

## Database connection diagnostics

`npm run db:check -- --target local --role all` performs read-only diagnostics.
Both targets accept `app`, `owner`, or `all` (default). Invalid options fail.
Every requested connection must resolve from a secret before any connection opens.

| Target / role | Provider secret name setting | Mounted secret file setting |
| --- | --- | --- |
| Local app | `DB_APP_SECRET_NAME` (default `database-secret-app`) | `DATABASE_URL_FILE` |
| Local owner | `DB_OWNER_SECRET_NAME` (default `database-secret-owner`) | `DATABASE_OWNER_URL_FILE` |
| Remote app | `REMOTE_DB_APP_SECRET_NAME` | `REMOTE_DATABASE_URL_FILE` |
| Remote owner | `REMOTE_DB_OWNER_SECRET_NAME` | `REMOTE_DATABASE_OWNER_URL_FILE` |

The `.env` file stores secret names/paths, never passwords or connection URLs.
Explicit file settings take precedence over provider names. Secret content may
be structured database JSON or a PostgreSQL URL. Remote secrets must be explicitly
configured and do not inherit local `DB_HOST`, `DB_PORT`, or `DB_NAME` overrides.
Local targets accept loopback and known Docker aliases only; external hosts fail.
Provider support follows the core implementation: file secrets work; the current
GSM/AWS adapters report that they are not configured.

`unavailable` in the migrations column means the query could not be completed,
not that no migrations exist. Use the owner role to inspect migration history.
