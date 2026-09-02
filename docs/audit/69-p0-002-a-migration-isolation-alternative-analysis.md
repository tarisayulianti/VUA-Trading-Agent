# P0-002-A — SANCTIONED MIGRATION ISOLATION ALTERNATIVE ANALYSIS

**Date:** 2026-09-02
**Environment:** Native Windows 10 x64, Node v22.23.2, pnpm 9.15.0
**Profile:** A — SQLite / development
**Task type:** Read-only migration-isolation alternative analysis
**Status:** ANALYSIS COMPLETE / NO-GO for current isolation approach

---

## A. P3019 EVIDENCE FROM DOC 68

**Exact error:**
```
P3019
The datasource provider `sqlite` specified in your schema does not match
the one specified in the migration_lock.toml, `postgresql`. Please remove
your current migration directory and start a new migration history with
prisma migrate dev.
```

**Trigger:**
```
pnpm prisma migrate dev --name init
```
with:
- `prisma.config.ts` containing `migrations.path: prisma/migrations-sqlite/`
- `prisma/schema-sqlite.prisma` with `provider = "sqlite"`
- Existing `prisma/migrations/migration_lock.toml` with `provider = "postgresql"`

---

## B. ROOT CAUSE OF FAILED ISOLATION

**Finding:**
Prisma 7.10.0's `migrate dev` does **not** fully honor `migrations.path` for
lockfile isolation in this version/path combination.

Evidence from Prisma 7.10.0 CLI source:
- `migrate dev` resolves `migrationsDirPath` via internal schema/config resolution
- It still discovers and reads `prisma/migrations/migration_lock.toml` even when
  `migrations.path` points elsewhere
- The lockfile provider check occurs before migration creation
- Error message explicitly instructs: "remove your current migration directory
  and start a new migration history"

**Conclusion:**
`migrations.path` in `prisma.config.ts` controls where NEW migration files are
written, but does NOT prevent Prisma from discovering and validating against
existing migration history in the default `prisma/migrations/` directory.

The attempted isolation via `migrations.path` is **insufficient** for Prisma 7.10.0
when the default migrations directory contains a conflicting provider lockfile.

---

## C. SUPPORTED ALTERNATIVES FOR PRISMA 7.10.0

### Alternative 1: Separate Prisma Project Boundary

**Mechanism:**
Place Profile A's Prisma config, schema, and migrations in a completely separate
directory tree that Prisma does not associate with the existing `prisma/` project.

Example structure:
```
prisma/                          # Profile B PostgreSQL (unchanged)
  schema.prisma
  migrations/
  migration_lock.toml
  config.postgres.ts

prisma-sqlite/                   # Profile A SQLite (new isolated project)
  config.ts
  schema.sqlite.prisma
  migrations/
```

**How it works:**
- Each profile has its own config file
- Each profile's `migrate dev` operates in its own directory
- No cross-profile lockfile discovery
- Prisma treats them as independent projects

**Compatibility with Prisma 7.10.0:**
- Fully supported
- Each config file is independently loaded via `--config`
- No undocumented behavior required

### Alternative 2: Separate Working Directory Invocation

**Mechanism:**
Run Profile A migration commands from a different working directory that contains
only Profile A files.

Example:
```
cd prisma-sqlite
pnpm prisma migrate dev --config config.ts --name init
```

**Compatibility:**
- Fully supported
- Standard Prisma CLI behavior
- No special configuration required

### Alternative 3: `prisma migrate dev --create-only` + Manual SQL Apply

**Mechanism:**
1. Temporarily remove/rename `prisma/migrations/migration_lock.toml`
2. Run `prisma migrate dev --create-only --name init`
3. Restore Profile B lockfile
4. Apply Profile A migration manually via SQLite

**Why it's rejected:**
- Temporarily removes Profile B migration history, even if restored afterward
- Risk of Profile B corruption if step 3 fails
- Violates "do not modify Profile B migration history" constraint
- Not a clean separation mechanism

### Alternative 4: `prisma migrate resolve` Workaround

**Mechanism:**
Use `prisma migrate resolve --rolled-back <migration>` to mark Profile B's
migration as rolled back, then run Profile A migration.

**Why it's rejected:**
- Modifies Profile B migration history
- Changes `_prisma_migrations` table state for PostgreSQL profile
- Violates preservation requirement

### Alternative 5: Manual DDL / Fake Migration

**Mechanism:**
Create SQLite tables manually or use a fake migration directory.

**Why it's rejected:**
- Explicitly forbidden by task constraints
- Bypasses Prisma migration workflow
- Loses schema versioning integrity

---

## D. COMPATIBILITY ASSESSMENT

| Alternative | Prisma 7.10.0 Compatible | Preserves Profile B | Supported | Risk |
|---|---|---|---|---|
| 1. Separate project boundary | YES | YES | YES | Low |
| 2. Separate working directory | YES | YES | YES | Low |
| 3. Lockfile removal workaround | NO | RISKY | NO | High |
| 4. migrate resolve workaround | YES | NO | NO | High |
| 5. Manual DDL/fake migration | N/A | N/A | NO | Critical |

---

## E. RECOMMENDED MECHANISM

**Alternative 1: Separate Prisma Project Boundary**

**Rationale:**
- Cleanest separation of Profile A and Profile B
- No modification of existing Profile B files
- Each profile has its own migration history
- Fully supported by Prisma 7.10.0
- Reversible without data loss
- Aligns with existing dual-profile architecture intent

**Implementation boundary:**
- Create `prisma-sqlite/` directory at repo root
- Move/copy Profile A config and schema there
- Run Profile A migrations from that directory
- Leave `prisma/` completely untouched for Profile B

---

## F. EXACT IMPLEMENTATION BOUNDARY FOR NEXT AUTHORIZED TASK

If authorized, the next task would:

1. Create `prisma-sqlite/` directory
2. Create `prisma-sqlite/config.ts` with:
   - `datasource.url` pointing to `file:./data/vua_p0_002_a.db`
   - `schema: path.join(__dirname, 'schema-sqlite.prisma')`
   - `migrate.adapter` using `@prisma/adapter-better-sqlite3`
   - `migrations.path` pointing to `prisma-sqlite/migrations/`
3. Copy `prisma/schema-sqlite.prisma` to `prisma-sqlite/schema-sqlite.prisma`
4. Run `pnpm prisma migrate dev --config prisma-sqlite/config.ts --name init`
5. Validate Profile A SQLite database
6. Verify `prisma/migrations/` remains byte-for-byte unchanged

**Boundaries:**
- `prisma/` directory: NOT modified
- `package.json`: NOT modified
- `pnpm-lock.yaml`: NOT modified
- `prisma.config.ts`: NOT modified further
- Profile B: completely untouched

---

## G. GO / NO-GO

**NO-GO for current approach**

The current approach of using `migrations.path` within the existing `prisma/`
project boundary is **not sufficient** for Prisma 7.10.0 migration isolation.

**GO for Alternative 1** pending explicit authorization.

---

## H. REQUIRED AUTHORIZATION GATE

Implementation requires explicit human authorization to:
1. Create `prisma-sqlite/` isolated Profile A project directory
2. Copy Profile A schema to isolated directory
3. Create isolated Profile A config
4. Run Profile A migrations from isolated boundary
5. Verify Profile B preservation

This is a **new authorization scope** beyond the current A2 implementation.

---

## I. VERIFICATION

- Document created: `docs/audit/69-p0-002-a-migration-isolation-alternative-analysis.md`
- No files modified
- No database changes
- No commit
- No push
- Profile B: untouched
