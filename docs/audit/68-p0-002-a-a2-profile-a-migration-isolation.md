# P0-002-A — A2 PROFILE-A MIGRATION ISOLATION

**Date:** 2026-09-02
**Environment:** Native Windows 10 x64, Node v22.23.2, pnpm 9.15.0
**Profile:** A — SQLite / development
**Status:** PARTIAL / MIGRATION BLOCKED

---

## A. BASELINE

- HEAD: `8d6043084f60efe21c7f3f983df4c8be1004ece0`
- origin/main: `8d6043084f60efe21c7f3f983df4c8be1004ece0`
- Profile B migration history: preserved, byte-for-byte unchanged
- Protected files: unchanged except `prisma.config.ts`

---

## B. AUTHORIZED CHANGE APPLIED

**File:** `prisma.config.ts`

**Change:**
- Added `datasource.url`
- Added `migrations.path` pointing to `prisma/migrations-sqlite`
- Preserved `PrismaBetterSqlite3` adapter
- Preserved `prisma/schema-sqlite.prisma` schema path

**Diff:** See `git diff -- prisma.config.ts`

---

## C. MIGRATION RESULT

**Command:**
```
pnpm prisma migrate dev --name init
```

**Result:** FAIL

**Error:**
```
P3019
The datasource provider `sqlite` specified in your schema does not match
the one specified in the migration_lock.toml, `postgresql`. Please remove
your current migration directory and start a new migration history with
prisma migrate dev.
```

**Assessment:**
Prisma 7’s `migrate dev` does not honor `migrations.path` for lockfile
isolation in this execution path. It still discovers `prisma/migrations/`
and reads the existing PostgreSQL `migration_lock.toml`, then aborts.

---

## D. PROFILE B PRESERVATION

- `prisma/migrations/migration_lock.toml`: unchanged
- `prisma/migrations/20260901154749_p0_002_b_u1_clean_init/migration.sql`: unchanged
- Hashes match pre-task values

Profile B remains untouched.

---

## E. PROFILE A MIGRATION DIRECTORY

**Path:** `prisma/migrations-sqlite/`

**State:** empty

**Purpose:** intended isolated SQLite migration history

**Result:** isolation configuration did not unblock `migrate dev`

---

## F. DATABASE STATE

- SQLite database file: not created
- No migration applied
- No schema changes applied
- Database untouched

---

## G. GIT STATE

- Modified: `prisma.config.ts`
- package.json / pnpm-lock.yaml: unchanged from authorized state
- Protected files: unchanged
- Profile B: untouched

---

## H. REMAINING A2 WORK

- Resolve migration-history isolation without modifying `prisma/migrations/`
- Run Profile A SQLite migration initialization
- Controlled SQLite validation
- Final A2 audit document

---

## I. NEXT AUTHORIZED ACTION

Requires explicit authorization for one of:
1. An alternative Prisma-supported migration-history separation mechanism that does not modify `prisma/migrations/`
2. A sanctioned temporary Profile A migration root/config that Prisma 7 accepts for `migrate dev`

Do not proceed without explicit authorization.

No commit. No push. No database changes.
