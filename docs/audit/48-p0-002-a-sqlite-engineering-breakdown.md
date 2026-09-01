# P0-002-A (PROFILE A) — SQLITE ENGINEERING BREAKDOWN (DOC-FIRST)
**Date:** 2026-09-02 — Document-only; no implementation executed
**Checkpoint:** 6d41144 (verified same as origin/main)
**Status:** P0-002-A SQLite runtime PASS; Prisma Client integration BLOCKED (schema provider + CLI timeout)
**Profile B (PostgreSQL):** COMPLETE / DOCUMENTED — separate profile, separate environment
**Role:** Principal Engineer ONLY | Trader Brain / Live Trading / Autonomous: DISABLED | P0-003: NOT STARTED

---

## 1. CURRENT STATE (EVIDENCE)
- SQLite CLI 3.46.1: PASS (INSERT/SELECT/UPDATE/TRANSACTION/persistence across restart)
- Canonical `prisma/schema.prisma` (PG): UNTOUCHED — must remain
- `prisma/schema-sqlite.prisma` (Profile A): EXISTING — SQLite-adapted
- `prisma/migrations/20260901154749_p0_002_b_u1_clean_init/migration.sql`: PG-specific DDL — does NOT apply to SQLite
- `data/vua_p0_002_a.db`: REAL SQLite DB (test data only; not committed)
- `docs/audit/40-p0-002-a-sqlite-implementation.md`: BLOCKED-ENV record (Prisma Client)
- `docs/audit/41-p0-002-a-final-acceptance.md`: PASS (runtime only; no Prisma Client integration claim)

## 2. REMAINING SQLITE GAPS (FROM 40/29-GAP-F)
- SQLite-compatible Prisma schema adaptation (provider = sqlite, portable types)
- SQLite migration DDL (`migration.sql` with SQLite syntax, not `gen_random_uuid()`)
- Prisma Client generation against SQLite provider (CLI timeout previously; retry when environment permits)
- SQLite `DATABASE_URL` = `file:./data/vua_p0_002_a.db`
- WAL mode (`PRAGMA journal_mode=WAL`) and FK enforcement (`PRAGMA foreign_keys=ON`) startup config
- Backup/recovery procedure (`sqlite3 .backup`)

## 3. EXACT NEXT TASK
**TASK-P0-002-A-PRISMA:** Create SQLite-compatible Prisma Client integration for Profile A.
NOT P0-003. NOT Profile B (complete). NOT source-edits to executionEngine/riskEngine (GAP-005 is P0-005, after DB).

## 4. WHY BEFORE P0-003
Per 24-engineering-dependency-order.md: ADR-002 (DB) → ADR-006 (Persistence) → GAP-003 (Data Foundation / P0-003). P0-003 requires DB persistence for `data_quality_log`; SQLite Profile A must be fully integrated (not just CLI-validated) before dependency chain advances.

## 5. DEPENDENCIES / PREREQUISITES
- Canonical `prisma/schema.prisma`: preserved (no edit)
- `prisma/config` / adapter: new/file-touched permitted for Profile A only
- `pnpm-lock.yaml` / `package.json`: permitted (dependency management only)
- `prisma/migrations/`: permitted to add SQLite-compatible migration (DO NOT modify canonical PG migration)
- `data/`: permitted for SQLite DB file / backup

## 6. ACCEPTANCE CRITERIA (PROFILE A ONLY)
- `npx prisma generate --schema=prisma/schema-sqlite.prisma` passes (0 errors)
- `npx prisma migrate dev --name sqlite_init` applies SQLite DDL
- `SELECT`/`INSERT`/`UPDATE`/`TRANSACTION` via Prisma Client (not sqlite3 CLI) against `data/vua_p0_002_a.db`
- Process restart: DB file intact, data readable via Prisma Client
- Schema drift check: `prisma/schema.prisma` (PG) unchanged by SHA

## 7. ALLOWED / FORBIDDEN
ALLOWED (Profile A only): `prisma/schema-sqlite.prisma`, `prisma/migrations/*-sqlite.sql`, `prisma/config*`, `docs/audit/`, `data/vua_p0_002_a.db`, `test_crud.mjs` (verified only; do not invent dummy contracts)
FORBIDDEN: `server/`, `src/`, `prisma/schema.prisma`, `prisma/migrations/20260901154749_p0_002_b_u1_clean_init/`, `package.json` dependency upgrades without documentation, Docker, PG start, P0-003, Trader Brain, Live/Autonomous trading, deletion of untracked `check_p003_state.py` / `data/` / `test_*.mjs` / `verify_p003.py`
STOP: If `prisma` CLI still times out (BLOCKED-ENV) — document, do not workaround (no dummy adapter, no mock client)

## 8. BLOCKERS
- Blocked-ENV (Prisma CLI timeout / ARM64 PRoot registry): DOCUMENT, do NOT invent workaround
- Schema provider mismatch (`UUID`/`DECIMAL`/`JSONB` vs SQLite): FIX via `schema-sqlite.prisma` (already exists; may need refinement) — do NOT edit canonical `schema.prisma`
- Docker Compose unavailable (Profile B only; not needed for A)

## 9. NEXT EXECUTION STEP (WHEN DOCUMENT APPROVED)
```
1. Inspect `prisma/schema-sqlite.prisma`; confirm provider = sqlite; confirm `@db` stripped
2. Generate SQLite DDL (or refine existing `prisma/migrations/`)
3. Run Prisma Client generation (with timeout-aware retry; document failure if env-blocked)
4. Validate CRUD via real Prisma Client against `data/vua_p0_002_a.db`
5. Write `docs/audit/42-p0-002-a-prisma-profile-a-completion.md` (only after real evidence)
```

## 10. RELATION TO P0-002-B (PG — COMPLETE)
- P0-002-B was PROFILE B (server/PG16/UUID contract/authorization). COMPLETE and documented separately in `42/43/44`
- Profile A (SQLite) is independent deployment profile; P0-002-B completion does NOT close Profile A gaps
- Canonical `prisma/schema.prisma` is the shared source (PG); `schema-sqlite.prisma` is Profile A adaptation
- No source change to `executionEngine` or `riskEngine` required for Profile A DB integration (GAP-005 / P0-005 is separate stage)

---
AUTHOR: Hermes — Principal Engineer ONLY
VERIFICATION: `git rev-parse HEAD` = 6d41144; `git status --short` shows 6 untracked (preserved); 0 modified tracked; 0 deleted
NO SOURCE EDITS MADE. NO INSTALLATIONS RUN. NO CRUD EXECUTED. NO P0-003 STARTED.

---

## 18. RECONCILIATION WITH 31-TESTING-ACCEPTANCE-STRATEGY
- Document 31 states ADR-002 = PENDING; superseded by 29-ADR-002-REVIEW (APPROVED dual-profile, 2026-09-01).
- 31's database-acceptance (DB-01..DB-10) applies to Profile B (PG); Profile A uses equivalent SQLite-specific criteria (DB-A01..A10 per 29-GAP).
- 31's NO-DUMMY gate applies to both profiles; Profile A SQLite must NOT use synthetic DB engine or mock adapter.
- 48 here preserves the Profile-A SQLite contract independently of 31's PG-oriented language.
