# P0-002-A — Node 24 LTS Isolated Compatibility Re-Test Plan
**Date:** 2026-09-02 — DOCUMENTATION ONLY / NO EXECUTION
**Source chain:** 48 → 49 → 50 → 51 → 52 → 53 (config/dependency authorization) → 54 (C-A implementation checkpoint) → 55 (final pre-implementation audit) → 56 (forensic analysis) → 57 (this plan)
**Current checkpoint:** e4f1980 (`prisma.config.ts` = C-A edited; 0 tracked modifications other than C-A; 14 untracked preserved)
**Role:** Principal Engineer ONLY | Profile A = SQLite / Termux / dev | Profile B = PostgreSQL / PC / production | SEPARATE
**Default:** **NO-GO** — this plan does NOT authorize execution; Node 24 test requires separate explicit human authorization.

---

## A. CURRENT NODE 26 ENVIRONMENT

| Dimension | Observed |
|-----------|----------|
| Node version | v26.8.1 (ABI 147) |
| Ubuntu | 26.04.1 LTS (PRoot/Termux) |
| Architecture | aarch64 (ARM64) |
| Prisma CLI | 7.10.0 (installed via pnpm 9.15.0) |
| @prisma/client | 7.10.0 |
| @prisma/adapter-better-sqlite3 | 7.10.0 (installed; C-A config matches) |
| CLI behavior (`timeout 30s npx prisma --version`) | **7 components load successfully** (config, adapter, engine, client, Query Compiler, PSL, Studio) → **process does not terminate** → killed by `timeout` at 30s (exit 124 / SIGALRM) |
| Classification | **BLOCKED-ENV** (Prisma 7 process lifecycle hang in PRoot) |
| C-A config state | **RESOLVED** — `prisma.config.ts` imports `@prisma/adapter-better-sqlite3` (`PrismaBetterSQLite3`); matches installed dependency |

---

## B. EXISTING FAILURE EVIDENCE (from 56 §C–§G)

| Evidence | Observed | Meaning |
|----------|----------|---------|
| Prisma 7.10.0 loads | YES | Dependency correct |
| ARM64 schema engine loads | YES (openssl-3.0.x variant) | Engine ABI correct |
| @prisma/adapter-better-sqlite3 loads | YES (C-A verified) | Config mismatch resolved |
| CLI prints full version banner | YES | All startup work completes |
| CLI does NOT call `process.exit()` | YES (hangs at event loop) | **Core failure** |
| 30s bounded test → timeout (exit 124) | YES | CLI never reaches normal exit |
| No error / exception / stack trace | Confirmed | Hang, not crash |
| `require('prisma.config.ts')` in plain Node also hangs | Confirmed (56 §G, P5) | TS loader / config resolution triggers hang in Prisma's loader |

**BLOCKED-ENV confirmed at CLI event-loop level.** The hang occurs after successful initialization.

---

## C. NODE 24 HYPOTHESIS

The isolated Node 24 LTS test is intended to determine **only** the following:

| # | Question | What a "yes" would mean |
|---|----------|-------------------------|
| 1 | Does Node 26's ABI (147) or event-loop behavior contribute to the Prisma 7 CLI lifecycle hang? | If Node 24 LTS (ABI 126 / 137 depending on minor) allows `prisma --version` to exit normally, the hang is partially Node-version-specific. |
| 2 | Does Prisma 7.10.0 CLI behave differently under Node 24 LTS in the same PRoot environment? | If Node 24 changes the hang behavior (e.g., clean exit), the problem is Node-version + PRoot interaction. |
| 3 | Does the hang remain specific to PRoot/environment regardless of Node version? | If Node 24 ALSO hangs identically, the blocker is **purely PRoot + Prisma 7** — Node version is not a factor. |
| 4 | Does the result change the environment classification? | If Node 24 PASS: reclassify as "Node 26 specific BLOCKED-ENV" → Profile A could use Node 24 LTS isolated (per 41). If Node 24 FAIL: classification remains "PRoot BLOCKED-ENV" — no Profile A path in this environment. |

**This test is a bounded diagnostic. It does NOT test `prisma generate`, `prisma migrate`, or any database operation.**

---

## D. ISOLATION REQUIREMENTS

The future Node 24 test MUST satisfy all of the following:

| Requirement | Enforcement |
|-------------|-------------|
| No repository source modification | `server/`, `src/`, config files untouched |
| No schema modification | `prisma/schema.prisma`, `prisma/schema-sqlite.prisma` untouched |
| No Prisma config modification | `prisma.config.ts` (C-A edit) must remain exactly as-is |
| No package manifest modification | `package.json` unchanged |
| No lockfile modification | `pnpm-lock.yaml`, `package-lock.json` unchanged |
| No migration modification | `prisma/migrations/` untouched |
| No database modification | `data/vua_p0_002_a.db` untouched |
| No Profile B modification | `prisma/schema.prisma`, `prisma/init.ts`, `server/`, `src/`, `docker-compose.yml` untouched |
| No alternative Prisma version install | Prisma 7.10.0 remains pinned |
| No Prisma downgrade | Version stays 7.10.0 |
| No second adapter install | Only `@prisma/adapter-better-sqlite3` remains installed |
| No mock / fake environment | Real Prisma 7 CLI only |

**The Node 24 runtime must be isolated:** installed via `nvm` or `n` or binary download to a temporary prefix (`/tmp/node24/` or `~/.nvm/versions/node/v24.x.x/`), **not** replacing system `node`/`npm`/`npx` in PATH for the project. The project's `package.json` `packageManager: "pnpm@9.15.0"` must remain unchanged.

---

## E. FUTURE TEST PROCEDURE

When authorized, the exact bounded procedure is:

```bash
# 1. Establish test environment (in a fresh shell)
cd ~/projects/VUA-Trading-Agent

# 2. Verify current state before switching
echo "=== PRE-TEST STATE ==="
node --version
npm --version
pnpm --version
node -p "require('./node_modules/prisma/package.json').version"
node -p "require('./node_modules/@prisma/client/package.json').version"
node -p "require('./node_modules/@prisma/adapter-better-sqlite3/package.json').version"
node -p "process.arch"
node -p "process.platform"

# 3. Install Node 24 LTS in isolation (NO project install)
#    Example using nvm (not yet installed; this is the only permitted install):
#    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
#    source ~/.bashrc
#    nvm install 24
#    nvm use 24

# 4. Re-verify Node version AFTER switch
echo "=== POST-SWITCH STATE ==="
node --version
npm --version
pnpm --version
node -p "require('./node_modules/prisma/package.json').version"
node -p "require('./node_modules/@prisma/client/package.json').version"
node -p "require('./node_modules/@prisma/adapter-better-sqlite3/package.json').version"
node -p "process.arch"
node -p "process.platform"

# 5. EXACT BOUNDED TEST (hard timeout enforced)
timeout 30s npx prisma --version

# 6. Record exit code and full output
echo "EXIT_CODE=$?"
```

**DO NOT proceed to any of the following in this test:**
- `prisma generate`
- `prisma migrate dev` / `prisma migrate deploy`
- `prisma db push` / `prisma db pull`
- `prisma studio`
- Any TypeScript/CRUD/transaction test

**If a separate authorization is later provided for A2-A3, those gates will have their own documented authorization documents.**

---

## F. TIMEOUT RULE

| Parameter | Value |
|-----------|-------|
| Timeout duration | **30 seconds** (same as 56 §C for direct comparability) |
| Enforcement | `timeout 30s` (GNU coreutils) — hard SIGALRM kill; NOT a soft timeout |
| Exit code 0 | **PASS** — Prisma CLI completed normally within 30s |
| Exit code 124 | **BLOCKED-ENV** — `timeout` killed process (SIGALRM); CLI did not terminate |
| Exit code 1-127 (non-zero, non-124) | **FAILURE / CRASH / ERROR** — classify by stderr output: dependency failure, config failure, engine failure, Node runtime failure |
| Exit code 126/127 | Command not found / permission — **CONFIGURATION / RUNTIME FAILURE** |
| Missing dependency error in output | **DEPENDENCY FAILURE** |
| "Segmentation fault" / "Aborted" | **BINARY / ENGINE / NODE RUNTIME FAILURE** |

**A timeout (exit 124) MUST NEVER be treated as PASS.** It means the CLI never called `process.exit()` within the bounded window.

---

## G. SUCCESS CRITERIA

The Node 24 test is **PASS** if AND ONLY IF all of the following are true:

1. `node --version` reports `v24.x.x` (LTS)
2. `npx prisma --version` starts and completes **within 30 seconds**
3. Output includes: `prisma : 7.10.0`, `@prisma/client : 7.10.0`, `Architecture : arm64`, `Schema Engine : ...arm64-openssl-3.0.x...`
4. Adapter load: no `MODULE_NOT_FOUND` for `@prisma/adapter-better-sqlite3`
5. Exit code is **0** (normal process exit)
6. No error / exception / stack trace in output

**Only if ALL 6 are true → Node 24 = PASS (environment capable for A2).**

---

## H. FAILURE CRITERIA

| Outcome | Classification | Meaning for Profile A |
|---------|----------------|----------------------|
| Exit 124 (timeout) | **BLOCKED-ENV** | CLI hangs identically to Node 26 → PRoot is the root cause; Node version does not help. Profile A cannot proceed in this environment. |
| Exit 1-127 with `MODULE_NOT_FOUND` / dependency error | **DEPENDENCY FAILURE** | Node 24 install or pnpm re-install missed a package — would need separate fix. Not a PRoot blocker. |
| Exit 1-127 with "Segmentation fault" / "Aborted" / "Illegal instruction" | **NODE / BINARY / ENGINE FAILURE** | ARM64 binary incompatibility with Node 24 + Prisma 7 engine. |
| Exit 1-127 with config / schema error | **CONFIGURATION FAILURE** | `prisma.config.ts` or `schema-sqlite.prisma` invalid under Node 24 (unlikely — TS is backward compatible). |
| CLI prints banner but no exit (same as Node 26) | **BLOCKED-ENV** | Same hang; Node version not a factor. |

**Do not conflate these.** A timeout is **BLOCKED-ENV**. A crash is **NODE/BINARY FAILURE**. A missing module is **DEPENDENCY FAILURE**. A config error is **CONFIGURATION FAILURE**.

---

## I. INTERPRETATION MATRIX

| Node 26 result | Node 24 result | Interpretation | Next decision |
|----------------|----------------|----------------|---------------|
| Hang (exit 124) | **Normal exit (0)** | Node 26 contributes to hang; Node 24 resolves it | Authorize Node 24 isolated path for Profile A (per 41) → proceed to A2 authorization |
| Hang (exit 124) | **Hang (exit 124)** | Hang is PRoot + Prisma 7 intrinsic; Node version irrelevant | BLOCKED-ENV stands; no Profile A path in this environment; require handoff to native Linux / WSL2 / macOS |
| Crash (before banner) | **Normal exit (0)** | Node 26 crash is Node-specific; Node 24 works | Same as first row — Node 24 path viable |
| Normal exit (0) | Normal exit (0) | Both work — original hang was transient / measurement artifact | Proceed to A2 authorization in current Node 26 (re-verify) |
| Hang (exit 124) | Crash / dependency failure | Node 24 introduces new failure; PRoot still blocks | Not a viable path; BLOCKED-ENV stands; environment handoff required |

---

## J. ROLLBACK / ISOLATION

The Node 24 test must be **fully reversible** without any change to the repository state:

| Rollback step | Verification |
|---------------|--------------|
| `nvm use system` (or close shell / remove `~/.nvm` PATH prepend) | `node --version` returns `v26.8.1` |
| No `pnpm install` / `npm install` was run | `package.json` / `pnpm-lock.yaml` / `package-lock.json` unchanged (git diff empty) |
| No schema / config / migration edit | `prisma.config.ts`, `prisma/schema*.prisma`, `prisma/migrations/` unchanged |
| No database touch | `data/vua_p0_002_a.db` mtime unchanged |
| No Profile B touch | `server/`, `src/`, `docker-compose.yml`, `prisma/init.ts` unchanged |
| No global install | No `npm install -g` / `pnpm add -g` |

The project's `package.json` declares `"packageManager": "pnpm@9.15.0"` — pnpm will use its own bundled Node if configured, but the test uses `nvm`/`n` to swap the active Node binary only.

---

## K. FORBIDDEN WORKAROUNDS (consolidated from 50, 51, 53, 54, 55, 56)

The following are **explicitly forbidden** for the Node 24 test and any subsequent work:

| Forbidden | Reason |
|-----------|--------|
| Fake / mock adapter | Violates no-dummy gate; does not resolve CLI hang |
| Mock Prisma Client | Violates no-dummy gate; does not resolve CLI hang |
| sqlite3 CLI substitution for Prisma CLI | Violates no-dummy gate; also does not test Prisma |
| Manual SQLite DDL / manual migration | Violates Prisma workflow; forbidden by 51 §F-3, 54 §I-7 |
| Manually generated DDL replacing `prisma migrate` | Forbidden — A3 requires real `prisma migrate dev --create-only` |
| Patched / modified Prisma binaries | Violates dependency integrity; not auditable |
| `LD_PRELOAD` shims / syscall interception | System modification; not permitted |
| Dependency downgrade | `package.json` / `pnpm-lock.yaml` are locked |
| Prisma version replacement | Prisma 7.10.0 is pinned; downgrade is not authorized |
| `package.json` modification without authorization | Only C-A edit (already done) was authorized |
| Profile A / Profile B merge | Architecture rule: never merge |
| PostgreSQL modification to solve SQLite env issues | Profile B is isolated; no cross-profile fixes |
| System package install (`apt`, `apk`, etc.) | No system modifications |
| Docker for Profile A | Profile A is SQLite / Termux / dev; Docker is Profile B |

---

## L. PROFILE A SCOPE

The Node 24 test concerns **only**:

**Profile A = SQLite / Termux / development runtime**

- Profile A datasource: `file:./data/vua_p0_002_a.db` (SQLite file)
- Profile A schema: `prisma/schema-sqlite.prisma` (provider=sqlite)
- Profile A config: `prisma.config.ts` (C-A adapter = `@prisma/adapter-better-sqlite3`)
- Profile A gates: A1 PASS; A2 BLOCKED; A3 BLOCKED; A4/A5 NOT STARTED; A6 PASS

**This test does not affect Profile B.**

---

## M. PROFILE B PROTECTION

**Profile B = PostgreSQL / PC / production-oriented database profile**

The Node 24 test must **NEVER** modify, touch, or redesign:

| Protected file | Reason |
|----------------|--------|
| `prisma/schema.prisma` | Canonical PostgreSQL schema — `@db.Decimal(18,4)`, `@db.Uuid`, etc.; provider=postgresql |
| `prisma/migrations/20260901154749_p0_002_b_u1_clean_init/migration.sql` | PG-specific DDL (`gen_random_uuid()`, `DECIMAL`, `JSONB`) — completed & validated |
| `prisma/migrations/migration_lock.toml` | `provider = "postgresql"` |
| `prisma/init.ts` | Default `@prisma/client` import — Profile B runtime entry |
| `server/` | Application source (executionEngine, riskEngine, multiAgentBrain, api routes) |
| `src/` | Frontend React source |
| `docker-compose.yml` | Profile B deployment (PostgreSQL 16) |

**Any modification to the above during Node 24 testing = VIOLATION.**

---

## N. AUTHORIZATION

| Gate | Description | Authorized by this document? |
|------|-------------|------------------------------|
| **N-0** | Human review of this plan (57) + forensic analysis (56) + audit chain (48-55) | **NOT** — this document is the input for that review |
| **N-1** | Explicit human authorization: "APPROVED: Node 24 isolated re-test" | **NOT** — requires separate message |
| **N-2** | Execute Node 24 install + `timeout 30s npx prisma --version` | **NOT** — requires N-1 |
| **N-3** | If Node 24 PASS: authorize A2 (`prisma generate`) | **NOT** — separate gate per 51 §N-5 / 54 §H-5 |
| **N-4** | If Node 24 FAIL: authorize environment handoff | **NOT** — separate gate |
| **N-5** | Commit any resulting documentation | **NOT** — requires N-3/N-4 outcome + explicit commit authorization |

**No execution is authorized by creating this document.**

---

## O. FINAL RECOMMENDATION

**Recommend Node 24 LTS isolated re-test as the final low-risk diagnostic before abandoning Prisma CLI execution in the current Termux/PRoot environment.**

| If Node 24 PASS | If Node 24 FAIL (hang/crash) |
|-----------------|-----------------------------|
| → Profile A can use Node 24 LTS isolated install (per 41) as its runtime | → Retain BLOCKED-ENV for this environment |
| → Authorize A2 (`prisma generate`) with separate gate | → Do NOT attempt workarounds (forbidden) |
| → Authorize A3 (`prisma migrate dev --create-only`) with separate gate | → Recommend native Linux / WSL2 / macOS handoff |
| → Proceed to A4/A5/A6 with successive gates | → Profile A remains PLANNED; Profile B remains COMPLETE |

**Rationale:** Node 24 LTS was already proven to work for SQLite CLI in PRoot (41 §1 — SQLite 3.46.1 PASS). The only remaining unknown is whether Prisma 7 CLI's event-loop lifecycle behavior differs under Node 24. The test is bounded (30s), reversible (nvm), isolated (no project changes), and carries no risk to repository state.

---

## P. GO / NO-GO

**DEFAULT: NO-GO.**

Node 24 execution remains **UNAUTHORIZED** until a separate explicit human authorization message provides gate **N-1**.

**No Node 24 installation. No `npx prisma --version` under Node 24. No Prisma CLI execution. No CRUD. No transactions. No Docker. No commit. No push.**

---

## VERIFICATION (post-doc, read-only)

- **New artifact only:** `docs/audit/57-p0-002-a-node24-compatibility-retest-plan.md`
- **Tracked modifications:** `prisma.config.ts` (C-A edit) — **no other tracked changes**
- `git diff --name-only` = `prisma.config.ts` only
- `package.json` unchanged
- `pnpm-lock.yaml` unchanged
- `package-lock.json` unchanged
- `prisma/schema.prisma` unchanged (PostgreSQL)
- `prisma/schema-sqlite.prisma` unchanged (SQLite)
- `prisma/init.ts` unchanged
- `prisma/migrations/` unchanged
- `server/`, `src/`, `docker-compose.yml` unchanged
- `data/vua_p0_002_a.db` untouched
- Docker untouched
- No Prisma commands executed
- No Node 24 installation performed
- All 14 untracked files preserved (6 pre-existing + 49-57 = 8 audit docs)
- HEAD = `e4f1980`
- origin/main = `e4f1980`
- No commit; no push

**STOP — plan complete. Awaiting human authorization (N-1) before any Node 24 test execution.**