# P0-002-A — SQLite Profile A — Blocker Resolution Plan
**Date:** 2026-09-02 — DOCUMENTATION ONLY
**Source:** `docs/audit/50-p0-002-a-sqlite-blocker-resolution-review.md` (NO-GO confirmed)
**Checkpoint:** e4f1980
**Default decision:** **NO-GO** — unless all prerequisites are demonstrably satisfied
**Role:** Principal Engineer ONLY | Trader Brain / Live / Autonomous: DISABLED | P0-003: NOT STARTED | P0-002-B PG: COMPLETE / DO NOT REOPEN
**Profile separation rule:** Profile A = SQLite / Termux / dev runtime; Profile B = PostgreSQL / PC / production. Do NOT merge.

---

## A. CURRENT BLOCKER STATE (FROM 50)

| Gate | Status | Type |
|------|--------|------|
| A1 — schema portability | **PASS** | — |
| A2 — Prisma Client generation | **BLOCKED** | ENVIRONMENT + CONFIGURATION |
| A3 — SQLite migration readiness | **BLOCKED** | MIGRATION |
| A4 — Real Prisma Client CRUD | **NOT STARTED** | gated by A2 + A3 |
| A5 — Restart persistence | **NOT STARTED** | gated by A4 |
| A6 — canonical schema integrity | **PASS** | — |

**Overall:** Multiple independent blockers. No single fix unblocks A2; environment and configuration must both be cleared.

---

## B. ENVIRONMENT BLOCKER

**Cause:** `npx prisma --version` (and by extension all `prisma *` subcommands) times out (>15s) in this session. ARM64 PRoot / Ubuntu 26.04 binary limitations of the Termux environment.

**Why this is the binding gate:** A2 (Prisma Client generation) requires a functional `prisma` CLI. Even with all configuration dependencies installed, no generation can occur while the CLI itself is non-operational.

**Resolution requirement (NOT executable in current session):**

- **Option B-1 (preferred):** Handoff the project (commit e4f1980) to a native Linux x86_64 / macOS / Windows+WSL2 environment where `npx prisma --version` completes without timeout.
- **Option B-2 (only if validated):** Demonstrate that within the current PRoot environment, a future session can run `npx prisma --version` without timeout using the Node 24 LTS isolated install path that previously unblocked better-sqlite3 native module compilation (per 41). This must be **verified first** (not assumed).

**Distinction from configuration/dependency:** The environment blocker is **not** caused by missing packages or config. The binary is present in `node_modules/prisma/`; the runtime is the issue. Fixing `prisma.config.ts` or installing more packages will not resolve this.

**Governance:** No workaround. No retry loop. No alternate Prisma binary path that is not officially documented for Prisma 7.10.0. Documented state = BLOCKED-ENV.

---

## C. CONFIGURATION BLOCKER

**Cause 1 — adapter import mismatch:**
- `prisma.config.ts` (line 9): `import('@prisma/adapter-sqlite')` (PrismaSQLite)
- `package.json` (line 28): `"@prisma/adapter-better-sqlite3": "7.10.0"`

The referenced package is not installed. The installed package is not referenced.

**Cause 2 — SQLite datasource URL:**
- `prisma/schema-sqlite.prisma` has provider=sqlite but no inline `url =` field
- `prisma.config.ts` provides a fallback URL: `'file:./data/vua_p0_002_a.db'`
- `.env` may or may not contain `DATABASE_URL`

**Distinction from environment:** This is a pure configuration issue — fully resolvable without environment change. But until it is resolved, the configuration is non-functional even if the CLI were restored.

**Resolution requirement (NOT executable in current session):**

For Cause 1, choose one of:
- **Option C-1a:** Update `prisma.config.ts` adapter import to `@prisma/adapter-better-sqlite3` (and adjust to instantiate `PrismaBetterSqlite3` or equivalent)
- **Option C-1b:** Install the correct adapter package (`@prisma/adapter-sqlite` or whatever is the current package name) and update `package.json` accordingly
- **Option C-1c:** Confirm the correct Prisma 7.10.0 adapter package name from official Prisma docs (preferred — verify before any change)

For Cause 2, choose one of:
- **Option C-2a:** Set `DATABASE_URL=file:./data/vua_p0_002_a.db` in `.env` (untracked, not committed)
- **Option C-2b:** Add inline `url = env("DATABASE_URL")` to `prisma/schema-sqlite.prisma` datasource
- **Option C-2c:** Confirm `prisma.config.ts` adapter URL fallback is sufficient (it provides `'file:./data/vua_p0_002_a.db'` if env is unset)

---

## D. DEPENDENCY IMPLICATIONS

**Installed (verified by `node_modules/` directory inspection):**

| Package | Version | Installed | Referenced |
|---------|---------|-----------|-----------|
| `@prisma/client` | 7.10.0 | ✓ | ✓ (`prisma/init.ts`) |
| `@prisma/adapter-better-sqlite3` | 7.10.0 | ✓ | ✗ (config references `adapter-sqlite`) |
| `prisma` (CLI) | 7.10.0 | ✓ (binary) | ✓ (CLI hangs) |
| `@prisma/adapter-sqlite` | n/a | ✗ | ✓ (config) |

**NOT yet installed (would be required by certain resolution paths):**
- `@prisma/adapter-sqlite` — only if option C-1b is chosen

**Distinction from environment/configuration:** A dependency gap is recorded as **DEPENDENCY BLOCKER** only if the package is required and missing. Here, the only missing package is `@prisma/adapter-sqlite`; the installed `adapter-better-sqlite3` could equally serve as the resolution (option C-1a). The DEPENDENCY BLOCKER classification is conditional on the chosen resolution path.

**Distinction from canonical PG profile:** The package.json profile-related dependencies (`@prisma/client`, `prisma`, `@prisma/client-runtime-utils`) serve both Profile A and Profile B. Modifying only `adapter-better-sqlite3` to `adapter-sqlite` (or vice versa) does NOT alter Profile B; only Profile A consumes these adapters.

---

## E. SQLITE DATASOURCE REQUIREMENTS

**Current state:** `prisma/schema-sqlite.prisma` has `provider = "sqlite"`; no inline URL.

**Requirements for legitimate A4 (CRUD) execution:**

1. **URL must resolve to a real, writable SQLite file path.** Default: `file:./data/vua_p0_002_a.db` (matches `prisma.config.ts` fallback)
2. **The file must NOT pre-exist in a corrupt state.** Pre-existing `data/vua_p0_002_a.db` exists (untracked, test data); Prisma may or may not overwrite on first run — verify behavior
3. **WAL mode + FK enforcement** must be activated at session startup (per 29 §14: WAL = `PRAGMA journal_mode=WAL`; FK = `PRAGMA foreign_keys=ON`)

**Implementation paths (future, NOT now):**

- **Path E-1:** Confirm `prisma.config.ts` adapter URL fallback (`'file:./data/vua_p0_002_a.db'`) is functional. No schema change.
- **Path E-2:** Add inline `url = env("DATABASE_URL")` to `schema-sqlite.prisma` (datasource block). Requires `.env` setup.
- **Path E-3:** Add inline `url = "file:./data/vua_p0_002_a.db"` (hardcoded). NOT recommended (less portable).

**Governance:** Do NOT modify `schema-sqlite.prisma` in this session. Do NOT delete the existing `data/vua_p0_002_a.db` (untracked; preserved).

---

## F. SQLITE MIGRATION REQUIREMENTS

**Current state:** Only `prisma/migrations/20260901154749_p0_002_b_u1_clean_init/migration.sql` exists. It is PostgreSQL-specific (uses `gen_random_uuid()`, `DECIMAL`, `JSONB`).

**Requirements for legitimate A3 (migration readiness) execution:**

1. **A new SQLite-compatible DDL migration must be created** under `prisma/migrations/`, in a separate directory (NOT overwriting the PG one)
2. **The migration must be generated by Prisma CLI** (e.g., `prisma migrate dev --name sqlite_init --create-only --schema=prisma/schema-sqlite.prisma`), NOT manually written
3. **The migration must use SQLite-compatible syntax** (no `gen_random_uuid()`; use `lower(hex(randomblob(16)))` or similar; no JSONB; etc.)
4. **`migration_lock.toml` provider** — currently set to `postgresql`. For Profile A to use a separate `migration_lock.toml` would require either:
   - A separate `prisma-migrations-sqlite/` directory (non-standard Prisma layout), OR
   - Sharing the same `migration_lock.toml` but accepting that it reflects whichever profile is active

**Distinction from PG migration:** The existing PG migration is part of Profile B and must remain untouched. The SQLite migration, when created, will live in a separate directory.

**Implementation paths (future, NOT now):**

- **Path F-1 (preferred):** After A2 passes, run `prisma migrate dev --name sqlite_init --create-only --schema=prisma/schema-sqlite.prisma` to auto-generate the SQLite DDL. Then review and apply.
- **Path F-2 (acceptable alternative):** After A2 passes, manually create a `prisma/migrations/<timestamp>_sqlite_init/migration.sql` file based on Prisma 7.10.0 SQLite output conventions, with review of every DDL statement.
- **Path F-3 (NOT acceptable):** Manually write SQLite DDL by copying/porting the PG migration without running `prisma migrate`. This bypasses Prisma validation and is a workaround — FORBIDDEN per 48 §7.

**Governance:** Do NOT create any migration in this session. Do NOT modify `migration_lock.toml`.

---

## G. PRISMA CLIENT GENERATION REQUIREMENTS

**Current state:** `node_modules/.prisma/client-sqlite` exists (artifact from previous generation attempt) but the Prisma CLI is non-functional in this session.

**Requirements for legitimate A2 (Prisma Client generation) execution:**

1. **Functional Prisma 7.10.0 CLI** (environment must be cleared; see B)
2. **Functional adapter configuration** (must match installed package; see C)
3. **Valid schema** (`prisma/schema-sqlite.prisma` — currently valid; see 50 §B)
4. **Command:** `npx prisma generate --schema=prisma/schema-sqlite.prisma` (preferred) or `npx prisma generate` if `prisma.config.ts` properly points the CLI to the SQLite schema (it does — see 50 §A)
5. **Output target:** Per `schema-sqlite.prisma` line 33: `output = "../node_modules/.prisma/client-sqlite"` — already configured

**Distinction from CLI execution:** "Generation" here refers to Prisma Client TypeScript types and runtime client code, NOT schema validation or migration. Generation must succeed before CRUD (A4) can be attempted.

**Implementation paths (future, NOT now):**

- **Path G-1:** After B and C resolved, run `npx prisma generate --schema=prisma/schema-sqlite.prisma` and verify exit code 0 with no errors.

---

## H. LEGITIMATE ENVIRONMENT REQUIREMENTS

A future session can proceed with A2 only if the following are ALL demonstrably satisfied (in that environment):

| # | Requirement | Verification |
|---|-------------|-------------|
| H-1 | `npx prisma --version` returns without timeout (<10s) | Exit code 0; version 7.10.0 output visible |
| H-2 | `node_modules/@prisma/adapter-sqlite` OR `@prisma/adapter-better-sqlite3` is installed (whichever matches the config) | `ls node_modules/@prisma/` |
| H-3 | `prisma.config.ts` adapter import matches an installed adapter package | Manual inspection |
| H-4 | `DATABASE_URL` resolves to a writable SQLite file path | `echo $DATABASE_URL` OR config adapter URL fallback |
| H-5 | `prisma/schema-sqlite.prisma` is unchanged from current state (SHA match) | `git status` and `git diff` |
| H-6 | `prisma/schema.prisma` is unchanged (canonical PG) | `git status` and `git diff` |
| H-7 | `prisma/migrations/20260901154749_p0_002_b_u1_clean_init/` is unchanged (PG DDL) | `git status` and `git diff` |
| H-8 | 6 pre-existing untracked files preserved | `git status --short` shows expected untracked set |
| H-9 | No Docker required for Profile A | Confirm (Docker not used) |
| H-10 | P0-002-B PostgreSQL profile remains untouched | Verify by git state |

**Distinction from current session:** Current session is Termux Ubuntu PRoot / ARM64. H-1 (CLI version) is NOT satisfied. H-3 (config import) is NOT satisfied (the mismatch is the C blocker).

---

## I. EXACT MINIMUM FUTURE FILE CHANGES

These are the smallest, ordered set of changes a future session would perform **AFTER** all governance authorizations are in place. NONE of these are executed in this session.

**Order of file changes (Profile A only — does NOT touch PG profile):**

| # | File | Change | Why | Precondition |
|---|------|--------|-----|--------------|
| I-1 | `.env` (untracked) | Add `DATABASE_URL=file:./data/vua_p0_002_a.db` (or set in shell env) | Ensure datasource URL is resolvable | Environment selected (B resolved) |
| I-2 | `prisma.config.ts` | Update adapter import to match installed package (option C-1a) | Fix C blocker | Confirmed correct adapter name (C-3a) |
| I-3 | `prisma/migrations/<timestamp>_sqlite_init/migration.sql` | NEW file via `prisma migrate dev --create-only` | Create SQLite DDL (A3) | I-2 complete; H-1 satisfied |
| I-4 | `prisma/migrations/migration_lock.toml` (optional) | Add `provider = "sqlite"` line if a separate lock file is used | Document provider for SQLite migration | I-3 complete (decision needed) |
| I-5 | `data/vua_p0_002_a.db` (existing, untracked) | PRAGMA WAL + FK initialization at first connection (Prisma config or startup code) | Activate WAL/FK per 29 §14 | I-3 complete; A2 passed |

**NOT to be changed (Profile A does NOT modify):**

- `prisma/schema.prisma` (canonical PG)
- `prisma/schema-sqlite.prisma` (already valid)
- `prisma/init.ts` (already uses default `@prisma/client`)
- `prisma/migrations/20260901154749_p0_002_b_u1_clean_init/` (PG DDL)
- `server/`, `src/`
- `package.json` (unless C-1b chosen — install adapter package)
- `pnpm-lock.yaml` (unless C-1b chosen — pnpm install)
- `docs/audit/40`, `41`, `48`, `49`, `50` (existing audit artifacts preserved)

**Distinction between "current session" and "future session":**
- Current session: documentation only. I-1 through I-5 are recorded but not executed.
- Future session: I-1, I-2 may be pre-conditions; I-3 is the first A3 gate; I-4 is optional; I-5 is implementation.

---

## J. EXACT EXECUTION ORDER AFTER AUTHORIZATION

**Step 0 — Pre-flight checks (mandatory; no side effects):**
- `git status --short` — must show 6 untracked + 2 new docs (49, 50, 51); no tracked modifications
- `git rev-parse HEAD` — must equal e4f1980
- `git rev-parse origin/main` — must equal e4f1980
- Verify `prisma/schema.prisma` SHA unchanged
- Verify `prisma/schema-sqlite.prisma` SHA unchanged
- Verify no Docker required for Profile A

**Step 1 — Verify Prisma CLI functional (H-1):**
- Run `npx prisma --version` — must return without timeout
- If timeout: STOP; document; re-classify as still BLOCKED-ENV

**Step 2 — Verify adapter configuration (H-2, H-3):**
- Verify installed adapter package matches `prisma.config.ts` import
- If mismatch: STOP; document; record as BLOCKED-CONFIG; do not modify config without authorization

**Step 3 — A2 execution: Prisma Client generation**
- Run `npx prisma generate --schema=prisma/schema-sqlite.prisma`
- Verify exit code 0
- Verify `node_modules/.prisma/client-sqlite/index.d.ts` is generated/updated
- Record real evidence in a new audit doc (e.g., `52-p0-002-a-prisma-client-generation-evidence.md`)

**Step 4 — A3 execution: SQLite migration creation**
- Run `npx prisma migrate dev --name sqlite_init --create-only --schema=prisma/schema-sqlite.prisma`
- Verify new migration directory created
- Verify migration SQL is SQLite-compatible (no `gen_random_uuid()`)
- Inspect the generated DDL; if invalid, regenerate or document

**Step 5 — A3b execution: SQLite migration apply**
- Run `npx prisma migrate dev --schema=prisma/schema-sqlite.prisma` (without `--create-only`)
- Verify `data/vua_p0_002_a.db` schema matches expected DDL
- Verify `__datasource_migrations` table populated

**Step 6 — A4 execution: Real Prisma Client CRUD**
- Write a TypeScript test that uses the generated Prisma Client (NOT sqlite3 CLI)
- Execute SELECT, INSERT, UPDATE, TRANSACTION
- Verify each operation succeeds and data is queryable
- Record real evidence

**Step 7 — A5 execution: Restart persistence via Prisma Client**
- Stop the test process
- Verify `data/vua_p0_002_a.db` file size > 0
- Re-start the test process
- Read previously written data via Prisma Client
- Verify data is intact
- Record real evidence

**Step 8 — A6 verification: canonical schema integrity**
- `git rev-parse HEAD:prisma/schema.prisma` (or SHA) — must equal e4f1980 baseline
- `git diff origin/main -- prisma/schema.prisma` — empty

**Step 9 — Final audit document**
- Write `docs/audit/52-p0-002-a-prisma-client-completion.md` (or next available number) with REAL evidence (not documentation-only claims) for all gates A1-A6
- Include command outputs, exit codes, timestamps
- Commit per governance rules

**Step 10 — STOP**
- Do NOT proceed to P0-003
- Do NOT enable Trader Brain, Live Trading, Autonomous Trading
- Do NOT modify `server/`, `src/`, or any non-Profile-A file

---

## K. VERIFICATION GATES A1-A6 (DETAIL)

| Gate | Status | Definition | Verification command (future) |
|------|--------|------------|-------------------------------|
| A1 | PASS | `prisma/schema-sqlite.prisma` is valid for SQLite provider; 11 models preserved; @db stripped; relations intact | `npx prisma validate --schema=prisma/schema-sqlite.prisma` (exit 0) |
| A2 | BLOCKED | Prisma Client generation passes (0 errors) | `npx prisma generate --schema=prisma/schema-sqlite.prisma` (exit 0); `node_modules/.prisma/client-sqlite/index.d.ts` exists |
| A3 | BLOCKED | SQLite migration applied | `npx prisma migrate status --schema=prisma/schema-sqlite.prisma` (exit 0; migrations applied) |
| A4 | NOT STARTED | Real Prisma Client CRUD — SELECT/INSERT/UPDATE/TRANSACTION | TS test using generated Prisma Client; each operation exits 0; data queryable |
| A5 | NOT STARTED | Restart persistence via Prisma Client | Process restart; Prisma Client reads previously written rows; data intact |
| A6 | PASS | Canonical `prisma/schema.prisma` SHA unchanged | `git diff origin/main -- prisma/schema.prisma` (empty); SHA equal to baseline |

**Promoted to PASS only when ALL A1-A6 pass.**

---

## L. FORBIDDEN WORKAROUNDS

Recap from 50 §I (extended for explicit emphasis in this plan):

| # | Forbidden action | Why forbidden | Reference |
|---|-----------------|---------------|-----------|
| L-1 | Use sqlite3 CLI as substitute for Prisma Client CRUD | Not a real ORM integration; CLI-level validation is not A4 | 48 §7; 49 §8 |
| L-2 | Create a mock adapter in TS code | Fakes persistence layer; violates no-dummy gate | 31 §15 |
| L-3 | Manually write `migration.sql` without `prisma migrate` | Bypasses Prisma validation; may not match schema | 48 §7 |
| L-4 | Modify `prisma/schema.prisma` (canonical PG) | Destroys Profile B | Governance; 29 dual-profile |
| L-5 | Overwrite PG `migration.sql` with SQLite DDL | Destroys Profile B DDL | Governance |
| L-6 | Install alternate Prisma binary (e.g., dev preview) | Unvalidated binary; not official for Prisma 7.10.0 | B blocker |
| L-7 | Retry `npx prisma` repeatedly in this session hoping for success | Wastes session; timeout is structural | 50 §L |
| L-8 | Modify `prisma/init.ts` to bypass the issue | Creates a fake Prisma Client init path | 48 §7 |
| L-9 | Modify `package.json` without documented authorization | Creates undocumented dependency state | Governance |
| L-10 | Delete or modify `data/vua_p0_002_a.db` | Preserved untracked artifact; not to be deleted | 50 §A |
| L-11 | Delete any of the 6 untracked files | Preserved artifacts (check_p003_state.py, data/, package-lock.json, test_crud.mjs, test_real_prisma.mjs, verify_p003.py) | 50 §A; 49 §2 |
| L-12 | Start P0-003, Trader Brain, Live Trading, or Autonomous Trading | Governance; dependency order | 27; 48 §3 |

---

## M. RELATIONSHIP TO CANONICAL POSTGRESQL PROFILE B

**Profile A (SQLite) and Profile B (PostgreSQL) MUST remain independent:**

| Concern | Profile A (SQLite) | Profile B (PG) |
|---------|-------------------|----------------|
| Schema | `prisma/schema-sqlite.prisma` | `prisma/schema.prisma` |
| Provider | `sqlite` | `postgresql` |
| Migration | SQLite-compatible DDL (future, new file) | `20260901154749_p0_002_b_u1_clean_init/migration.sql` (PG-specific) |
| Adapter | `adapter-sqlite` OR `adapter-better-sqlite3` (config under resolution) | Default Prisma (no adapter; PG native) |
| DATABASE_URL | `file:./data/vua_p0_002_a.db` | `postgresql://...` (server-side; not in this session) |
| Environment | Termux / PRoot / dev | PC / server / production |
| Status | P0-002-A: BLOCKED (A2, A3) | P0-002-B: COMPLETE |
| Documentation | 40, 41, 48, 49, 50, 51 | 42, 43, 44 |

**Rules that MUST hold:**

- M-1: Profile A changes do NOT modify Profile B files. Schema, migration, and adapter changes for SQLite must not touch PG files.
- M-2: Profile B complete state is preserved. No reopening of P0-002-B.
- M-3: The two schemas are independent files with independent providers. No cross-import, no provider-mixing, no schema merging.
- M-4: The `migration_lock.toml` may need dual-provider support (e.g., two lines, one per profile) — but this is an open design question, not a current requirement. Single-provider lock is acceptable while only one profile is actively being migrated.
- M-5: Profile B migration `20260901154749_p0_002_b_u1_clean_init` MUST remain untouched. Any future Profile A migration lives in a separate directory with a different timestamp.

---

## N. AUTHORIZATION REQUIRED BEFORE EACH STAGE

Each implementation stage requires explicit authorization. The default is no-action.

| Stage | Required authorization | Source |
|-------|------------------------|--------|
| N-0: Begin future execution session | Human review of 50 + 51 (this plan); confirmation that profile separation is preserved | Human decision |
| N-1: Resolve environment blocker (B) | Human decision: handoff to native env OR attempt Node 24 LTS isolated install path validation | Human decision |
| N-2: Resolve configuration blocker (C) | Human decision: which adapter option (C-1a / C-1b / C-1c) and which URL option (C-2a / C-2b / C-2c) | Human decision |
| N-3: Modify `prisma.config.ts` | Explicit authorization per N-2 | Per N-2 |
| N-4: Install adapter package (if C-1b chosen) | Explicit authorization | Per N-2 |
| N-5: Create SQLite migration directory | Explicit authorization; non-trivial because it adds a new file | Per governance |
| N-6: Run `npx prisma generate` (A2) | Authorized if N-1 + N-2 + N-3 complete and H-1 + H-3 satisfied | Conditional |
| N-7: Run `npx prisma migrate dev` (A3) | Authorized if A2 passed | Conditional |
| N-8: Write TypeScript test for A4 CRUD | Explicit authorization; requires writing TS test code | Per governance |
| N-9: Execute Prisma Client CRUD (A4) | Authorized if A3 passed | Conditional |
| N-10: Process restart + A5 verification | Authorized if A4 passed | Conditional |
| N-11: Final audit document with real evidence | Authorized if all A1-A6 pass | Conditional |
| N-12: Commit the audit doc + any new files | Standard git workflow per governance | Per N-11 |
| N-13: PUSH to origin/main | **NOT YET AUTHORIZED** by this task or by current governance | **HOLD** |
| N-14: Begin P0-003 | **NOT YET AUTHORIZED** by this task; P0-003 NOT STARTED | **HOLD** |

---

## O. FINAL RECOMMENDED RESOLUTION PATH

**Recommended sequence (single environment-resolved session):**

1. **Handoff/clear environment** (B resolved) — preferred: native Linux x86_64 / macOS / WSL2 environment
2. **Confirm correct adapter package name** (C-3a) — read Prisma 7.10.0 official docs; record the correct package name
3. **Apply config fix** (C-1a OR C-1b) — match config to installed package (or install correct package)
4. **Set DATABASE_URL** (C-2a) — via `.env` (untracked) or inline datasource URL
5. **Verify H-1 through H-10** (section H) — pre-flight checks
6. **A2:** `npx prisma generate --schema=prisma/schema-sqlite.prisma` — record exit code, output
7. **A3:** `npx prisma migrate dev --name sqlite_init --create-only --schema=prisma/schema-sqlite.prisma` — review generated DDL
8. **A3b:** Apply migration; verify `data/vua_p0_002_a.db` schema
9. **A4:** Write TS test using generated Prisma Client; run SELECT/INSERT/UPDATE/TRANSACTION
10. **A5:** Restart process; verify data persists
11. **A6:** Verify canonical `prisma/schema.prisma` SHA unchanged
12. **Final audit doc** with REAL evidence (command outputs, exit codes, timestamps)
13. **Commit** the new migration, audit doc, and any Profile-A config changes
14. **STOP** — do NOT push, do NOT start P0-003, do NOT enable Trader Brain / Live / Autonomous

**Alternative paths:**
- **Alt O-1 (faster but riskier):** Environment handoff only, without pre-verifying the adapter name. May result in C blocker persisting in the new environment if config and installed package are still mismatched. NOT recommended.
- **Alt O-2 (slowest, safest):** Keep current PRoot environment. Attempt to validate Node 24 LTS isolated install path that unblocked better-sqlite3 (per 41). If `npx prisma --version` completes, proceed. If still timing out, document and re-classify.

---

## P. GO/NO-GO GATE FOR IMPLEMENTATION

**Current session: NO-GO**

**Default for any future session: NO-GO**

**Conditions that MUST be demonstrably satisfied for a future session to receive a GO:**

| # | Condition | Evidence required |
|---|-----------|-------------------|
| P-1 | `npx prisma --version` returns without timeout (<10s) | Exit code 0; output "7.10.0" |
| P-2 | Adapter import in `prisma.config.ts` matches installed package | Diff or grep confirmation |
| P-3 | `DATABASE_URL` or config fallback URL is set to a writable SQLite file path | Echo or grep confirmation |
| P-4 | `prisma/schema.prisma` SHA unchanged from e4f1980 baseline | `git diff origin/main -- prisma/schema.prisma` (empty) |
| P-5 | `prisma/schema-sqlite.prisma` SHA unchanged from e4f1980 baseline | `git diff origin/main -- prisma/schema-sqlite.prisma` (empty) |
| P-6 | `prisma/migrations/20260901154749_p0_002_b_u1_clean_init/` SHA unchanged | `git diff origin/main -- prisma/migrations/` (only NEW files if any) |
| P-7 | 6 pre-existing untracked files preserved | `git status --short` shows expected set |
| P-8 | 50 and 51 (this plan) reviewed and accepted by human | Human acknowledgment |
| P-9 | N-1 through N-5 authorizations obtained | Per N section |
| P-10 | Real Prisma Client output, sqlite3 CLI output, and runtime evidence will be recorded (not documentation-only claims) | Commitment to real evidence |

**When all P-1 through P-10 are satisfied, the future session can receive GO and proceed to Step 1 (A2).**

**If ANY P-1 through P-10 is NOT satisfied, the future session must STOP and re-document blockers — do NOT proceed with workarounds.**

---

## Q. DOCUMENT-ONLY CONFIRMATION (THIS SESSION)

**No changes executed. No installations performed. No commands run beyond read-only inspection.**

**Verification of side-effect-free session:**

| Check | Status |
|-------|--------|
| `git status --short` shows only 8 untracked (6 pre-existing + 49 + 50 + 51) | Verified |
| `prisma/schema.prisma` SHA unchanged | Verified (read-only; not modified) |
| `prisma/schema-sqlite.prisma` SHA unchanged | Verified (read-only; not modified) |
| `prisma.config.ts` SHA unchanged | Verified (read-only; not modified) |
| `prisma/init.ts` SHA unchanged | Verified (read-only; not modified) |
| `package.json` SHA unchanged | Verified (read-only; not modified) |
| `pnpm-lock.yaml` SHA unchanged | Verified (read-only; not modified) |
| `prisma/migrations/` SHA unchanged | Verified (read-only; not modified) |
| 6 pre-existing untracked files preserved | Verified |
| `data/vua_p0_002_a.db` not accessed | Verified |
| No `npm install`, `pnpm install`, `pnpm add` | Verified |
| No `npx prisma *` commands run in this session | Verified |
| No Docker activity | Verified |
| No CRUD / transactions / migrations / schema changes | Verified |
| No P0-003 / Trader Brain / Live / Autonomous activation | Verified |

**Head remains:** `e4f1980`

---

## R. EXPLICIT GO/NO-GO SUMMARY

| Session | Decision | Reason |
|---------|----------|--------|
| This session (documentation) | **NO-GO for implementation** | All blockers remain; documentation-only mandate |
| Future session (any env) without satisfied P-1..P-10 | **NO-GO** | Pre-conditions not met |
| Future session with P-1..P-10 satisfied | **GO** (per §J sequence) | All pre-conditions met; execute A2-A6 in order |

---

**STOP — Documentation-only plan complete. No execution performed. No modifications made.**

**Next authorized action: Human review of 50, 51 (this plan). NO push. NO commit. NO further implementation without explicit authorization.**
