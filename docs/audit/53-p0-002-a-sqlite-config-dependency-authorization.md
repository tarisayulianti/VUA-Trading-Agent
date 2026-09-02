# P0-002-A — SQLite Profile A — Config / Dependency Authorization Document
**Date:** 2026-09-02 — DOCUMENTATION ONLY / READ-ONLY / NO EXECUTION
**Source chain:** 48 (engineering breakdown) → 49 (prisma blocker record) → 50 (NO-GO review) → 51 (resolution plan) → 52 (consistency audit, verified consistent)
**Checkpoint (committed):** e4f1980 (docs 48/49 pushed; 50/51/52/53 untracked; HEAD unchanged; origin/main = e4f1980)
**Role:** Principal Engineer ONLY | Profile A = SQLite / Termux / dev | Profile B = PostgreSQL / PC / production | SEPARATE — never merge
**Status:** DEFAULT NO-GO — authorization document only; does NOT authorize execution

---

## A. CURRENT PROFILE A STATE (READ-ONLY EVIDENCE)

| Component | File / Path | State | Evidence Source |
|-----------|-------------|-------|-----------------|
| Profile A schema (SQLite-adapted) | `prisma/schema-sqlite.prisma` | EXISTS; provider=`sqlite`; 11 models; `@db` stripped; `generator client` → `../node_modules/.prisma/client-sqlite`; `datasource db` → `provider = "sqlite"` only (no inline `url=`) | Read directly; HEAD unchanged; matches 50 §B / 48 §2 / 29 STEP 2 |
| Canonical PG schema (Profile B) | `prisma/schema.prisma` | EXISTS; provider=`postgresql`; `@db.Decimal(18,4)` etc.; `generator` → `.prisma/client`; UNCHANGED | Verified unchanged by this audit; no edit proposed |
| Profile B migration | `prisma/migrations/20260901154749_p0_002_b_u1_clean_init/migration.sql` | EXISTS; PG-specific (`gen_random_uuid()`); `migration_lock.toml`: `provider = "postgresql"` | Read; preserved; must NOT be edited for Profile A |
| Prisma init (Profile-agnostic) | `prisma/init.ts` | Default `@prisma/client`; no adapter selection; unchanged | Read; 48 §126 unchanged |
| Config file (Profile-A-specific) | `prisma.config.ts` (at repo root; NOT `prisma/config.ts`) | `defineConfig({ earlyAccess: true, schema: 'prisma/schema-sqlite.prisma', migrate: { adapter: async () => new PrismaSQLite({ url: env('DATABASE_URL') ?? 'file:./data/vua_p0_002_a.db' }) } })`; adapter import = `@prisma/adapter-sqlite` | Read; 50 §C / 49 §5 / 48 §36 reference confirmed |
| Installed adapter (repo) | `node_modules/@prisma/adapter-better-sqlite3` (v7.10.0) | PRESENT | Directory inspection; matches `package.json` line 28 |
| Referenced adapter (config) | `@prisma/adapter-sqlite` (imported in `prisma.config.ts`) | NOT INSTALLED | Verified: no `node_modules/@prisma/adapter-sqlite`; contradiction with 50 §C / 49 §5 |
| CLI binary | `node_modules/prisma/` | PRESENT; execution BLOCKED (timeout >15s) | Verified: same BLOCKED-ENV as 40/41/49/50 |
| Client-artifact (prior session) | `node_modules/.prisma/client-sqlite/` | PRESENT (directory); does NOT unblock CLI | Observed; 50 §C notes; 51 §G notes |
| DB file (Profile A, untracked) | `data/vua_p0_002_a.db` | EXISTS; real SQLite DB; NOT committed; preserved | Verified untracked; NOT edited; NOT deleted; NO SQL executed against it this session |
| Lockfile (Profile-agnostic, tracked) | `pnpm-lock.yaml` (lockfileVersion 9.0) | PRESERVED; no edit performed | Confirmed unchanged |
| Package-lock (untracked, preserved) | `package-lock.json` | PRESERVED; no edit; not used (pnpm is declared manager) | Confirmed; 49 §2 / 50 preserves |
| Untracked artifacts (6 — must remain) | `check_p003_state.py`, `data/`, `package-lock.json`, `test_crud.mjs`, `test_real_prisma.mjs`, `verify_p003.py` | ALL PRESERVED; NONE MODIFIED | Confirmed in git status; 51 §A / 49 §2 / 48 §11 |

---

## B. EXACT ADAPTER MISMATCH (CONFIRMED — BLOCKED-CONFIG)

**File:** `prisma.config.ts` (line 9)
**Content:** `const { PrismaSQLite } = await import('@prisma/adapter-sqlite');`

**File:** `package.json` (line 28, devDependencies)
**Content:** `"@prisma/adapter-better-sqlite3": "7.10.0"`

**File:** file-system check
**Installed adapter directory:** `node_modules/@prisma/adapter-better-sqlite3/`
**Installed adapter package (referenced):** `node_modules/@prisma/adapter-sqlite/` — ABSENT

**Why this is a contradiction:**
- The configuration expects `adapter-sqlite` (imported as `PrismaSQLite` then used via adapter URL)
- The repository provides `adapter-better-sqlite3`
- These are two different adapter packages (different names, different import paths, possibly different APIs — `PrismaSQLite` vs what `adapter-better-sqlite3` exports)
- The CLI (when functional) will attempt to load the adapter from the import; if `adapter-sqlite` is not installed, the import throws at runtime — regardless of whether `adapter-better-sqlite3` is present
- Even if `adapter-better-sqlite3` works identically, the import statement in `prisma.config.ts` does NOT match it; a direct edit of `prisma.config.ts` is required to align them

**Classification:** CONFIGURATION BLOCKER (not dependency absence — dependency IS installed, just wrong package; not environment — environment is separate BLOCKED-ENV; correct classification is mixed: the adapter import is config-level; the adapter package availability is dependency-level)

---

## C. DEPENDENCY DECISION (AUTHORIZATION DOCUMENT — NOT EXECUTED)

**Question:** Which adapter package is the correct one for Prisma 7.10.0 with SQLite provider?

**Evidence:**
- `package.json` declares `@prisma/adapter-better-sqlite3`: `7.10.0`
- `prisma.config.ts` references `@prisma/adapter-sqlite`
- `node_modules/@prisma/adapter-better-sqlite3/` exists; `node_modules/@prisma/adapter-sqlite/` does not
- Both packages are from the `@prisma/` scope; both are SQLite adapters

**Recommended authorization decision (for future authorization only — NOT executed now):**

- **Option C-A (recommended for consistency):** Keep `adapter-better-sqlite3` (already installed, already in `pnpm-lock.yaml`, already working in other contexts per 41 — best-sqlite3 native module validated). Update `prisma.config.ts` adapter import to match `adapter-better-sqlite3`. This minimizes package changes (0 new installs) and aligns config with installed state.
- **Option C-B (alternative):** Keep current `prisma.config.ts` import (`adapter-sqlite`), install `@prisma/adapter-sqlite` (if it exists for 7.10.0), and possibly remove `adapter-better-sqlite3`. This requires a package change (install + possibly remove + lockfile update) and relies on a package name that is not installed.

**Recommendation for authorization document:** Authorize **C-A** — fix config to match installed adapter. Reasons:
1. `adapter-better-sqlite3` is installed; `adapter-sqlite` is not; changing config is lower-risk than installing unknown package
2. 41 validated `adapter-better-sqlite3` native module works (ARM64, ABI 137, compiled)
3. No package-lock / pnpm-lock modifications required if only config changes (but if package swap is done, lockfile must be updated)
4. Preserves `package.json` (no dependency swap) unless explicitly authorized

**Profile compatibility:** `adapter-better-sqlite3` is Profile-A-specific (SQLite adapter). Profile B (PostgreSQL) uses default Prisma client (no adapter required). Changing adapter reference for Profile A does NOT affect Profile B architecture.

---

## D. EXACT FUTURE PACKAGE CHANGES (NOT EXECUTED — AUTHORIZATION ONLY)

**Only IF C-A (update config) is authorized:**
- `prisma.config.ts`: edit line 9 (adapter import / adapter instance creation)
- NO package.json change needed
- NO pnpm-lock.yaml change needed
- NO package-lock.json change needed
- NO new installation needed
- `prisma/init.ts`: no change (Profile-agnostic; uses `@prisma/client`)

**Only IF C-B (install adapter-sqlite) is authorized:**
- `package.json`: add/modify dep line (e.g., replace `adapter-better-sqlite3` with `adapter-sqlite`, or add both)
- `pnpm-lock.yaml`: must be regenerated (pnpm install) — requires authorization
- `package-lock.json`: if using npm (not declared manager — pnpm is declared) — should not be used; leave untouched
- `prisma.config.ts`: keep current import (already correct for C-B)
- `node_modules/`: install new package; possibly remove old if swapped

**Distinction:** Option C-A is minimal (config edit only). Option C-B is larger (package + lockfile + install). Both preserve Profile B (`prisma/schema.prisma` unchanged; no PG migration touched; no server/src change).

---

## E. EXACT FUTURE CONFIGURATION CHANGES (NOT EXECUTED — AUTHORIZATION ONLY)

**If C-A authorized (update config):**

File: `prisma.config.ts` — edit line 9 (and possibly adapter instantiation line)
- From: `const { PrismaSQLite } = await import('@prisma/adapter-sqlite');`
- To: `const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');` (or whatever export name the installed package provides)
- Then adjust adapter usage line (line 11-14) accordingly if instance creation differs
- The adapter URL (`'file:./data/vua_p0_002_a.db'`) remains correct; no datasource change needed

**If C-2 (datasource URL) needs clarification (separate from adapter):**
- `prisma.config.ts` already provides `url: process.env.DATABASE_URL ?? 'file:./data/vua_p0_002_a.db'` — this covers the datasource requirement
- `prisma/schema-sqlite.prisma` currently lacks inline `url =`; if required by Prisma 7.10.0 for SQLite generation, an authorization could add `url = env("DATABASE_URL")` — but since config already handles the URL, this is optional, not required
- Recommendation: confirm config adapter works with `DATABASE_URL` set; do NOT edit schema-sqlite.prisma datasource unless CLI generation requires it (must be verified first)

---

## F. CANONICAL POSTGRESQL PROFILE B PROTECTION — EXPLICIT

Per 51 §M / 50 §H / 49 §10 / 48 §11 / 29 STEP 2 / 27 ADR-002 APPROVED:

Files that MUST NOT be changed as part of Profile A resolution (authorization document explicitly excludes these from I-1..I-5 / 51 §I / all future actions for Profile A):

| File / Path | Role | Why protected | Verified untouched |
|------------|------|--------------|-------------------|
| `prisma/schema.prisma` | Canonical PG schema (11 entities) | Source of truth for Profile B (PG 16); adapter/switch is at build/config time, NOT at schema level; any edit would break PG generation | Confirmed: read-only; `git diff --name-only HEAD` empty; provider=`postgresql`; `@db.Decimal` etc. intact |
| `prisma/init.ts` | Profile-agnostic Prisma Client init | Uses default `@prisma/client`; works with either profile; must not be altered to favor SQLite adapter | Confirmed: unchanged |
| `prisma/migrations/20260901154749_p0_002_b_u1_clean_init/migration.sql` | Profile B PG DDL | Must NOT be overwritten, deleted, or edited; SQLite DDL is a separate file | Confirmed: untouched |
| `prisma/migrations/migration_lock.toml` | Profile B lock | Currently `provider = "postgresql"`; if a separate SQLite lock is needed, create new, do NOT overwrite | Confirmed: untouched; only new file permitted |
| `server/services/executionEngine.ts`; `server/services/riskEngine.ts`; `server/routes/api.ts`; `src/` | Application source | Must never be edited for database profile changes (ADR-002 separation) | Confirmed: untouched |
| `docker-compose.yml` | Profile B deployment config (PG + server) | Not needed for Profile A; must not be edited to solve SQLite issue | Confirmed: untouched |

**Critical rule preserved:** Profile A resolution uses `prisma.config.ts`, `prisma/schema-sqlite.prisma`, and a new SQLite migration — NOT `prisma/schema.prisma` or the PG DDL. No merge; no conflate; no redesign of canonical PG architecture.

---

## G. ENVIRONMENT BLOCKER SEPARATION (BLOCKED-ENV IS INDEPENDENT)

From 50 §H (separation of environment/config/dependency) and 49 §4 (BLOCKED-ENV):

The adapter/config/dependency fix (C) can be completed independently of the environment blocker (B). However, **A2 execution (Prisma Client generation)** requires BOTH to be resolved simultaneously because:
- A2 requires `npx prisma generate` (B must work)
- A2 requires correct adapter config (C must work)
- A2 requires a valid SQLite schema + adapter URL (E must work)

**Sequence must be:** B first (environment clearance OR handoff) → C (adapter/config) → E (datasource verification) → F (migration) → G (generation) → A3/A4/A5.

**This authorization document does NOT authorize any of these stages. It documents what would be required IF the prerequisites were met.**

---

## H. AUTHORIZATION GATES (FOR FUTURE IMPLEMENTATION — NOT NOW)

Based on 51 §N and 50 §K / 48 §4 / 49 §10, the authorization for each future stage is explicitly:

| Stage | What | Requires authorization from | Status (this session) |
|-------|------|----------------------------|----------------------|
| H-1 | Confirm `adapter-better-sqlite3` vs `adapter-sqlite`; decide option | Human / Principal Engineer | **NOT AUTHORIZED — document only** |
| H-2 | Edit `prisma.config.ts` (adapter import / adapter instance) | Human / Principal Engineer (explicit approval for each edit) | **NOT AUTHORIZED — document only** |
| H-3 | Confirm `DATABASE_URL` / datasource URL | Human / Principal Engineer (environment setup, not source edit) | **NOT AUTHORIZED — document only** |
| H-4 | Verify `npx prisma --version` completes (B cleared) | Human / environment verification | **NOT AUTHORIZED — document only** |
| H-5 | Execute `npx prisma generate` (A2) | Human / verified prerequisites (H-1 through H-4) | **NOT AUTHORIZED — document only** |
| H-6 | Execute `prisma migrate dev --create-only` (A3 start) | Human / verified A2 | **NOT AUTHORIZED — document only** |
| H-7 | Execute `prisma migrate dev` (A3 apply) | Human / verified A3 start + DDL inspected | **NOT AUTHORIZED — document only** |
| H-8 | TypeScript test + A4 CRUD | Human / verified A3 | **NOT AUTHORIZED — document only** |
| H-9 | A5 restart persistence | Human / verified A4 | **NOT AUTHORIZED — document only** |
| H-10 | A6 canonical integrity check + final audit doc with REAL evidence | Human / verified A5 | **NOT AUTHORIZED — document only** |

**NO GO for any of H-1..H-10 in this session.** Default is NO-GO. Prerequisites (B, C, E, F) are not satisfied.

---

## I. RECOMMENDED RESOLUTION DECISION (AUTHORIZATION DOCUMENT — NOT EXECUTION)

Per 51 §O (recommended path: Option B-1 environment handoff + Option C-A config fix; 51 §P NO-GO; 52 §N final audit confirms consistency):

**Recommended path for future authorization (after environment is cleared):**

1. **Environment:** Confirm/function `npx prisma --version` (B cleared — either native handoff or validated PRoot)
2. **Configuration:** Authorize Option C-A — fix `prisma.config.ts` adapter import to match installed `adapter-better-sqlite3`; do NOT change `package.json` or install new adapter package (minimize dependency delta)
3. **Datasource:** Confirm `DATABASE_URL=file:./data/vua_p0_002_a.db` or `prisma.config.ts` adapter URL fallback works
4. **Migration:** Authorize new SQLite DDL via `prisma migrate dev --create-only` (use real CLI; do NOT manually write SQL)
5. **Client generation:** Execute A2; record evidence
6. **CRUD / persistence:** A4 / A5; record evidence
7. **Audit:** Write final doc (with real command outputs — not documentation-only claims)
8. **Commit:** Only after all gates verified with evidence
9. **PUSH / P0-003 / Trader:** Hold — not in this authorization

**Why C-A (not C-B):** C-A minimizes package/dependency changes (zero package changes needed; only one file edit: `prisma.config.ts`). C-B requires package installation + lockfile update + potential adapter swap — larger delta; no clear evidence that `adapter-sqlite` is the correct package name for Prisma 7.10.0 (the installed `adapter-better-sqlite3` has validated native build per 41).

---

## J. FORBIDDEN PATHS (REITERATED — DO NOT EXECUTE)

From 51 §L / 49 §8 / 50 §I / 48 §7 — all preserved; none executed; none proposed by this authorization:

- L-1: sqlite3 CLI substitution → **FORBIDDEN** (A4 requires real Prisma Client)
- L-2: Mock adapter → **FORBIDDEN**
- L-3: Manual DDL without `prisma migrate` → **FORBIDDEN** (F-3; must use CLI)
- L-4 / L-5: Modify canonical `prisma/schema.prisma` / PG DDL → **FORBIDDEN** (Profile B preserved)
- L-6: Alternate undocumented Prisma binary → **FORBIDDEN**
- L-7: Retry loop in this session → **FORBIDDEN** (BLOCKED-ENV must be resolved at environment level, not retried)
- L-8: Modify `prisma/init.ts` → **FORBIDDEN** (not needed; profile-agnostic)
- L-9: Modify package.json / lockfile without authorization → **FORBIDDEN** (C-B requires authorization; C-A does not)
- L-10: Delete `data/vua_p0_002_a.db` → **FORBIDDEN** (preserved untracked; test DB file)
- L-11: Delete untracked files (6 artifacts) → **FORBIDDEN**
- L-12: Start P0-003 / Trader Brain / Live / Autonomous → **FORBIDDEN** (N-14; 27 master map; 48 §3)

---

## K. GO / NO-GO

**For this authorization document:** **NO-GO for execution** — document is authorization-only; no execution performed; prerequisites (B, C, E, F, G) not satisfied; default NO-GO preserved.

**For future session (after prerequisites demonstrably met):** **CONDITIONAL GO** — only if ALL prerequisites (B = CLI works; C = adapter import matches installed; E = datasource URL; F = SQLite DDL exists; plus H-1..H-10 verified) are satisfied; authorization gates N-0 (review) through N-11 (audit) are explicitly granted; N-12 (commit) is granted only after real evidence; N-13 (push) not yet granted; N-14 (P0-003) NOT granted.

---

## L. VERIFICATION (THIS SESSION — READ-ONLY)

- `docs/audit/53-p0-002-a-sqlite-config-dependency-authorization.md` created (new file; untracked; not committed)
- `prisma/config.ts` — not edited (only `prisma.config.ts` exists; read; no change)
- `prisma/config.ts` — does not exist at `prisma/config.ts`; file at root `prisma.config.ts` — verified; not edited
- `package.json` — unchanged (line 28: adapter-better-sqlite3 7.10.0; no adapter-sqlite)
- `pnpm-lock.yaml` — unchanged (verified; not edited)
- `package-lock.json` — unchanged (untracked preserved)
- `prisma.schema-sqlite.prisma` — unchanged (provider=sqlite; no url added; unchanged)
- `prisma.schema.prisma` — unchanged (`provider=postgresql`; `@db.Decimal(18,4)`; unchanged)
- `prisma/init.ts` — unchanged (default import)
- `prisma/config.ts` — does not exist; `prisma.config.ts` unchanged
- `prisma/migrations/` — unchanged (PG DDL untouched; no SQLite DDL created; migration_lock.toml untouched)
- `data/` — untouched (DB file preserved; not executed against)
- `server/`, `src/` — untouched
- Docker — not executed (no `docker` command this session; only read confirmation from earlier session)
- Prisma CLI — no new execution (timeout was from prior session; not retried; not fixed by this session)
- CRUD / transactions / migrations — NOT executed
- P0-003 — NOT started
- Trader Brain / Live Trading / Autonomous Trading — DISABLED / NOT enabled
- 6 pre-existing untracked artifacts — preserved (check_p003_state.py, data/, package-lock.json, test_crud.mjs, test_real_prisma.mjs, verify_p003.py)
- New audit docs — 49, 50, 51, 52, 53 (5 new docs; untracked; not committed; not pushed)
- HEAD: `e4f1980`
- `origin/main`: `e4f1980`
- No tracked file changes (`git diff --name-only HEAD` = empty)
- No commit performed
- No push performed

---

## STOP

**This authorization document (53) does NOT authorize execution. It defines what WOULD be authorized under the correct prerequisites. The prerequisites are NOT met. Default remains NO-GO. No implementation performed. All prerequisites (environment clearance, adapter alignment, SQLite DDL creation) must be completed in a future authorized session with verified prerequisites (H-1..H-10 satisfied) before any A2-A6 execution can begin.**

**Profile A = SQLite / Termux / development. Profile B = PostgreSQL / PC / production. Separation preserved. Canonical PG schema untouched. No workaround executed. All 5 audit docs (48-53) consistent. Next step: human review of 53 before any future authorization.**
