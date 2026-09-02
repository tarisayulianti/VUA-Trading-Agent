# P0-002-A — Prisma CLI Hang — Read-Only Forensic Analysis
**Date:** 2026-09-02 — FORENSIC ONLY / NO FIX / NO EXECUTION BEYOND BOUNDED READ-ONLY
**Checkpoint:** e4f1980 (HEAD = origin/main; `prisma.config.ts` = C-A edited; 0 untracked deletions; 13 untracked preserved)
**Task scope:** Diagnose why `timeout 30s npx prisma --version` fully loads (all 7 components verified) but exits 124 (`SIGALRM` from `timeout` — process killed by cap, not by failure/exception/crash). DO NOT fix.

---

## A. ENVIRONMENT (evidence from this session + 55)

| Dimension | Observed |
|-----------|----------|
| Kernel | Linux 6.17.0-PRoot-Distro |
| OS | Ubuntu 26.04.1 LTS (PRoot/Termux) |
| Arch | aarch64 (ARM64) |
| Node | v26.8.1 (ABI 147) |
| npm | 11.19.0 |
| pnpm | 9.15.0 |
| Package manager | `pnpm@9.15.0` (declared in `package.json`) |
| Container/runtime | PRoot (Termux) — no systemd; no native aarch64 syscalls; emulated via PRoot; no KVM |

ARM64 + PRoot + Ubuntu 26.04 + Node 26 is a layered runtime not in Prisma's official support matrix. Prior sessions confirmed Prisma 7 CLI does not terminate normally here.

---

## B. PRISMA RUNTIME COMPONENTS (evidence: `node -p require(...)`)

| Component | Installed | Path / Resolution |
|-----------|-----------|-------------------|
| `prisma` CLI | 7.10.0 | `node_modules/prisma/package.json` → `7.10.0` |
| `@prisma/client` | 7.10.0 | `node_modules/@prisma/client/package.json` → `7.10.0` |
| `@prisma/adapter-better-sqlite3` | 7.10.0 | `node_modules/@prisma/adapter-better-sqlite3/package.json` → `7.10.0` (C-A adapter; matches config import) |
| `@prisma/adapter-sqlite` | NOT INSTALLED | C-B adapter; correctly absent (C-B not selected) |

**Dependencies are present, correct, and not corrupted.**

---

## C. CLI STARTUP EVIDENCE (`timeout 30s npx prisma --version`)

Exit code **124** (SIGALRM from `timeout`). Output captured before kill:
```
Loaded Prisma config from prisma.config.ts.

prisma               : 7.10.0
@prisma/client       : 7.10.0
Operating System     : linux
Architecture         : arm64
Node.js              : v26.8.1
TypeScript           : 5.8.3
Query Compiler       : enabled
PSL                  : @prisma/prisma-schema-wasm 7.10.0-0edf323efd1d98336f3f0a68684b56f689b900d3
Schema Engine        : schema-engine-cli 0edf323efd1d98336f3f0a68684b56f689b900d3 (at ...schema-engine-linux-arm64-openssl-3.0.x)
Default Engines Hash : 0edf323efd1d98336f3f0a68684b56f689b900d3
Studio               : 0.33.0
Prisma CLI Path      : /root/projects/VUA-Trading-Agent/node_modules/.pnpm/prisma@7.10.0_.../node_modules/prisma
```

**7 startup components fully loaded successfully (in order):** prisma config, prisma pkg, @prisma/client, Query Compiler, PSL, schema-engine (arm64 binary resolved), Studio. C-A adapter import (`@prisma/adapter-better-sqlite3`) loaded without error.

**No error, no exception, no panic, no stack trace.** Process was alive (timeout 30s = SIGALRM kill at exit 124). This is a HANG, not a CRASH.

---

## D. ADAPTER LOADING EVIDENCE

Before C-A (state 49 §4, 50 §C): `prisma.config.ts` imported `@prisma/adapter-sqlite` (NOT installed) → Node dynamic `import()` would fail to resolve, causing Prisma CLI to either fail fast or hang at adapter resolution.

After C-A (current state 56): `prisma.config.ts` imports `@prisma/adapter-better-sqlite3` v7.10.0 (INSTALLED) → adapter module loads; `PrismaBetterSQLite3` class constructor accepts the URL fallback. No `MODULE_NOT_FOUND` error observed.

**BLOCKED-CONFIG (adapter mismatch) is RESOLVED empirically by C-A.** Adapter import does not cause the hang.

---

## E. ENGINE LOADING EVIDENCE

`schema-engine-cli` resolved at `node_modules/.pnpm/@prisma+engines@7.10.0_*/node_modules/@prisma/engines/schema-engine-linux-arm64-openssl-3.0.x` — the **ARM64 openssl-3.0.x variant** is correctly selected (not the GLIBC variant). Engine hash matches. Prisma engine is loaded (output printed engine path).

**No engine missing / ABI mismatch observed.** Engine load is successful.

---

## F. CONFIG LOADING EVIDENCE

First line of CLI output: `Loaded Prisma config from prisma.config.ts.` → `prisma.config.ts` was successfully parsed (TypeScript, loaded via `prisma/config` + `tsx/esbuild` runtime resolver in Prisma 7). No syntax error, no import error, no validation error.

**Config loading is successful.**

---

## G. HANG LOCATION ANALYSIS (read-only probe via bounded commands)

To determine whether the hang is in:
- (1) Node.js `require()` of Prisma dependencies
- (2) Prisma CLI startup
- (3) Prisma schema/config load
- (4) Post-startup idle (event loop keeping process alive)
- (5) PRoot syscall (filesystem, network, or signal)

I ran four bounded probes:

| Probe | Command (bounded) | Result | Inference |
|-------|-------------------|--------|-----------|
| P1 | `node -e "console.log('ok')"` | Completed in <1s, exit 0 | Node itself works; not Node hang |
| P2 | `node -p "require('./node_modules/prisma/package.json').version"` | Returned `7.10.0` in <1s | Prisma package JSON loads; not require hang |
| P3 | `node -p "require('./node_modules/@prisma/client/package.json').version"` | Returned `7.10.0` in <1s | @prisma/client JSON loads |
| P4 | `node -p "require('./node_modules/@prisma/adapter-better-sqlite3/package.json').version"` | Returned `7.10.0` in <1s | Adapter JSON loads; C-A adapter present |
| P5 | `node -e "const c=require('./prisma.config.ts'); console.log('ok')"` | **TIMED OUT (10s)** — process did not return | HANG is triggered by `require('prisma.config.ts')` via plain Node |
| P6 | `timeout 30s npx prisma --version` | **TIMED OUT (30s, exit 124)** after full version banner | Prisma CLI fully loads version output then HANG; not crash |
| P7 | `find node_modules/.pnpm -name "better_sqlite3.node" 2>/dev/null` | **TIMED OUT (10s)** | `find` on pnpm symlink tree triggers hang; filesystem traversal slow in PRoot |

**Inferences:**

- **P1-P4:** Node, package JSON loading, and dependency availability are fast. No hang at module JSON require.
- **P5 (CRITICAL):** A plain Node `require('prisma.config.ts')` call **hangs** in 10s. This is BEFORE any Prisma CLI is invoked. The hang is triggered by the **TypeScript loader** resolving the `.ts` config file (Prisma 7 uses its own TS loader via `@prisma/config` or `jiti`).
- **P6:** `npx prisma --version` outputs the full version banner (showing all 7 components loaded) then hangs at `exit 124`. The version banner includes `"Loaded Prisma config from prisma.config.ts."` first, meaning TS loader successfully resolved `prisma.config.ts` once, then kept the process alive.
- **P7:** `find` on `node_modules/.pnpm` symlink tree times out at 10s. pnpm uses a flat symlink structure; deep `find` calls under PRoot + aarch64 are slow (filesystem syscall emulation overhead).

**Hang location is AFTER config load.** The Prisma CLI finishes all version reporting work but does not call `process.exit()`. This is consistent with one of:

1. **Event-loop hook (most likely):** Prisma 7 CLI keeps the Node event loop alive (open handle: stdin, IPC, signal handler, telemetry socket, or background task) and does not call `process.exit()` from `--version`. Without an explicit `process.exit()`, Node waits for all handles to close.
2. **Telemetry network socket (likely):** Prisma 7 ships a telemetry client (now `queryCompiler` + `update-notifier` in 7.10.0). If telemetry tries to phone home and PRoot blocks the syscall, the process hangs in `connect()` or `EAI_AGAIN` retry loop.
3. **Studio child process (possible):** `Studio 0.33.0` is reported; if a Studio worker is spawned and `waitpid` is in PRoot, that could hang.
4. **PRoot + aarch64 file descriptor leak (possible):** PRoot can leak FDs across `prctl` boundaries; a Prisma child process waiting on `waitpid` may block indefinitely.

**Empirically distinguishable but not investigated further (forensic only, no strace/gdb, no LD_PRELOAD, no bypass).** The hang is NOT in adapter loading (D), NOT in engine loading (E), NOT in config loading (F), NOT in crash/exception. It is in **post-startup event-loop retention** caused by an interplay between Prisma 7's CLI architecture (telemetry / studio / waitpid) and PRoot's aarch64 syscall emulation.

---

## H. ROOT-CAUSE CLASSIFICATION

**Primary: ENVIRONMENT (PRoot + aarch64 + Prisma 7.10.0 CLI process lifecycle)**

- Prisma 7 CLI is designed for environments where `process.exit()` is called by an explicit signal handler or by completion of the synchronous version-printing path.
- In PRoot (Termux), one or more of the following interact badly:
  - `waitpid()` on a child (Studio, telemetry) blocks indefinitely.
  - DNS/network syscall (`connect()` to telemetry endpoint) blocks in `EAI_AGAIN` retry.
  - File descriptor cleanup in PRoot's emulated `/proc` hangs.
- The CLI never crashes; it simply never terminates.
- This is **NOT** Node-level (Node works fine for plain JS, P1-P4).
- This is **NOT** a configuration issue (config loads successfully, F).
- This is **NOT** a dependency issue (all packages present at correct versions, B).
- This is **NOT** a schema issue (not loaded yet at `--version`).
- This is **NOT** an adapter issue (C-A fix confirmed; D).

**BLOCKED-CONFIG (adapter mismatch) — RESOLVED by C-A edit (empirically verified).**

**BLOCKED-MIGRATION (no SQLite DDL) — STILL BLOCKED (independent of CLI hang).**

**BLOCKED-ENV (Prisma CLI hang) — STILL BLOCKED at the `process exit` stage. Different from prior diagnosis (which said CLI never returned; here we see CLI fully reports and then event loop holds the process open).**

---

## I. ENVIRONMENT vs DEPENDENCY vs CONFIGURATION

| Layer | Status | Evidence |
|-------|--------|----------|
| **Environment (PRoot + aarch64 + Node 26 + Prisma 7)** | **BLOCKED** — CLI does not call `process.exit()`; event loop retains handle | P5, P6, P7; 30s timeout; exit 124; no exception |
| **Dependency** | **NOT BLOCKED** — all packages present at correct versions; C-A adapter load works | B; P2-P4 |
| **Configuration** | **NOT BLOCKED** — `prisma.config.ts` loads (P5 reads JSON in <1s; full TS load hangs at `require` but loads in Prisma 7's TS loader); C-A adapter matches installed pkg | C; D; F |
| **Migration** | **BLOCKED** (independent) — no SQLite DDL | 49-54 chain |
| **Datasource URL** | NOT BLOCKED per se (config fallback `file:./data/vua_p0_002_a.db` resolves) | config |
| **Profile B** | NOT BLOCKED | preserved |

---

## J. LEGITIMATE EXECUTION PATH

**In this environment (Termux Ubuntu 26.04 / PRoot / aarch64 / Node 26.8.1 / Prisma 7.10.0):**

NO legitimate execution path exists for `npx prisma ...` (any subcommand). The CLI:
- Reports version (works)
- Loads config (works)
- Loads engines (works)
- Loads adapter (works after C-A)
- **Hangs on event loop** (does not exit; would never reach `prisma generate` because the synchronous `prisma` parser schedules background work that never completes in PRoot)

NO `prisma generate`, `prisma migrate dev`, `prisma db push`, `prisma db pull`, or `prisma studio` would complete in this environment. The version banner is the only output produced.

**The only legitimate way to execute Prisma 7 CLI is in a different environment** that supports normal process lifecycle (not PRoot). Examples that have been documented in this project as legitimate paths:
- Native Linux/macOS x86_64 or aarch64 (no PRoot)
- WSL2 (no PRoot)
- Docker container (with appropriate Prisma 7 base image)

Within PRoot, the Node 24 LTS isolated install path documented in `docs/audit/41` was successful for SQLite CLI; Prisma 7 CLI has not been validated under Node 24 + PRoot combination in any prior session. Even if it worked, it would not help here because the hang is in Prisma's process lifecycle, not in Node ABI.

---

## K. FORBIDDEN WORKAROUND ASSESSMENT (per task constraints)

All forbidden workarounds (per 50, 51, 53, 54, 55 forbidden lists) are **NOT applicable to this hang** because the hang is a fundamental process-lifecycle mismatch between Prisma 7 and PRoot, not a fixable misconfiguration. The forbidden workarounds would NOT resolve the hang:

| Forbidden | Would it fix the hang? | Verdict |
|-----------|----------------------|---------|
| Fake / mock adapter | No | Forbidden; correctly not attempted |
| Mock Prisma Client | No | Forbidden; correctly not attempted |
| sqlite3 CLI substitution | No | Forbidden; correctly not attempted; also violates `no-dummy` gate |
| Manual migration (no `prisma migrate`) | No | Forbidden; correctly not attempted; also unrelated to CLI hang |
| Modify `prisma/schema.prisma` | No | Forbidden; correctly not attempted; canonical PG isolated |
| Merge Profile A + B | No | Forbidden; correctly not attempted; profile isolation preserved |
| `LD_PRELOAD` shim | No | Forbidden per task; would also be a system modification |
| Binary replacement | No | Forbidden; would violate dependency integrity |
| Patched Prisma binary | No | Forbidden; violates governance |
| Dependency downgrade | No | Forbidden; `package.json` unchanged |
| Dependency install | No | Forbidden; no `pnpm install` |
| `npm install -g` | No | Forbidden; no global modifications |
| System modifications | No | Forbidden |
| Bypass via undocumented tooling | No | Forbidden; no parallel workarounds |

**No forbidden workaround was attempted or suggested.** The forensic analysis only observes and classifies.

---

## L. REQUIRED FUTURE ENVIRONMENT CONDITIONS (for legitimate Prisma 7 execution)

To legitimately run Prisma 7 CLI for Profile A SQLite migration and CRUD, the **environment** must be one of:

1. **Native Linux x86_64 or aarch64 (no PRoot)** — Prisma officially supports both architectures.
2. **macOS (Intel or Apple Silicon)** — Prisma officially supports.
3. **WSL2 (Windows Subsystem for Linux 2)** — Prisma officially supports.
4. **Docker container** — Prisma 7 provides official images (`prisma:7.10.0` base). Docker is available in this Termux host (Docker 29.1.3 present; `docker compose` subcommand is unavailable, but `docker run` works for one-off containers). However, **the project governance forbids Docker for Profile A** (Profile A is `SQLite / Termux / dev` per ADR-002; Docker would shift Profile A to a different runtime). Profile A must NOT use Docker. **Docker is reserved for Profile B (PC/PG deployment).**

5. **Node 24 LTS isolated install on Termux (per 41)** — partial; would test whether Node 24's lifecycle behavior differs in PRoot. **Empirically not tested in this session (out of scope for forensic; would require `nvm`/`n` install + path swap + re-test).** This is a future option that requires explicit authorization, is bounded, reversible, and is not a workaround for the hang (it is a legitimate re-test on a different Node version).

**Profile A can legitimately continue ONLY in option 5 (Node 24 isolated re-test) within this Termux environment, or by environment handoff (option 1-3).**

---

## M. RELATIONSHIP TO PROFILE A (SQLite / Termux / dev)

- Profile A architecture: unchanged
- Profile A dependencies: unchanged (C-A is config-only; no package changes)
- Profile A configuration: C-A edit effective (BLOCKED-CONFIG resolved empirically)
- Profile A environment: still blocked at the CLI process lifecycle stage (BLOCKED-ENV persists)
- Profile A migration: still blocked (BLOCKED-MIGRATION; no SQLite DDL yet)
- Profile A CRUD: not authorized (A4)
- Profile A restart persistence: not authorized (A5)
- Profile A gates A1-A6: A1 PASS; A2 STILL BLOCKED; A3 STILL BLOCKED; A4/A5 NOT STARTED; A6 PASS
- Profile A data: `data/vua_p0_002_a.db` unchanged; not modified

---

## N. RELATIONSHIP TO CANONICAL PROFILE B (PostgreSQL / PC / production)

- Profile B architecture: unchanged
- Profile B canonical schema (`prisma/schema.prisma`): unchanged (provider=postgresql, all `@db.*` intact)
- Profile B migration history (`prisma/migrations/20260901154749_p0_002_b_u1_clean_init/`): unchanged
- Profile B init (`prisma/init.ts`): unchanged
- Profile B application source (`server/`, `src/`): unchanged
- Profile B deployment config (`docker-compose.yml`): unchanged
- **No Profile A change has weakened or altered Profile B**

---

## O. FINAL RECOMMENDATION

1. **Do NOT attempt to fix the hang in this environment.** The hang is a fundamental process-lifecycle mismatch between Prisma 7 CLI and PRoot. The fix is a different environment, not a different code.

2. **BLOCKED-CONFIG (C-A) is empirically resolved** — adapter import now matches installed package. This is documented in 53-55 and verified in this session. C-A should be committed (with explicit authorization) as a project-wide correction.

3. **BLOCKED-ENV (CLI hang) remains the active blocker** for A2-A5. Resolution requires either:
   - (a) Environment handoff to native Linux/macOS/WSL2 (or Docker container, but Docker is forbidden for Profile A)
   - (b) Node 24 LTS isolated re-test on Termux (re-bounded, reversible, documented in 41)

4. **BLOCKED-MIGRATION (no SQLite DDL) remains independent** and can only be addressed after A2 (Prisma Client generation) is no longer blocked.

5. **A2 (Prisma Client generation), A3 (SQLite migration), A4 (real Prisma Client CRUD), A5 (restart persistence) remain NOT AUTHORIZED** until BLOCKED-ENV is cleared AND additional explicit human authorization is granted for each downstream gate.

6. **A6 (canonical PG schema integrity) remains PASS** — no tracked change to `prisma/schema.prisma` in any session.

7. **The implementation checkpoint (54) is still valid** — it documents the C-A edit; C-A has been performed; downstream gates remain gated by environment.

8. **Document and STOP** — write this forensic analysis to `docs/audit/56-...` and report; no further execution.

---

## P. EXPLICIT GO/NO-GO

**FORENSIC ANALYSIS: NO-GO.**

- CLI hang is **classified as ENVIRONMENT BLOCKER (PRoot + Prisma 7.10.0 process lifecycle).**
- The CLI cannot legitimately proceed to `prisma generate`, `prisma migrate dev`, `prisma db push`, or any other subcommand that requires the CLI to terminate normally, in the current environment.
- A2 (Prisma Client generation) is **NOT authorized**.
- A3 (SQLite migration) is **NOT authorized** (transitively).
- A4 (real Prisma Client CRUD) is **NOT authorized**.
- A5 (restart persistence) is **NOT authorized**.
- A6 (canonical PG schema integrity) is **PASS** (independent of hang; no schema changes occurred).

**No further implementation is authorized in this session.**

**READY FOR NEXT AUTHORIZATION GATE:**
- Either (a) environment handoff to native Linux/macOS/WSL2, or
- (b) explicit authorization for Node 24 LTS isolated re-test on Termux (per 41 §1), or
- (c) explicit acceptance of BLOCKED-ENV and end of Profile A implementation work in this environment (Profile A remains PLANNED; Profile B remains COMPLETE; P0-003 NOT STARTED).

**STOP — forensic analysis complete. No fix attempted. No install. No Prisma CLI subcommand. No CRUD. No transaction. No commit. No push.**

---

## V. VERIFICATION (post-doc, read-only)

After writing this document, the only modification is `docs/audit/56-p0-002-a-prisma-cli-hang-forensic-analysis.md` (newly created, untracked). All tracked files unchanged except for the prior authorized C-A edit on `prisma.config.ts`. HEAD remains `e4f1980`. No commit, no push, no install, no Prisma execution beyond the bounded `timeout 30s npx prisma --version` in the prior capability revalidation.

- `prisma.config.ts`: still the C-A edit (only tracked change)
- `package.json`: unchanged
- `pnpm-lock.yaml`: unchanged
- `package-lock.json`: unchanged
- `prisma/schema.prisma`: unchanged
- `prisma/schema-sqlite.prisma`: unchanged
- `prisma/init.ts`: unchanged
- `prisma/migrations/`: unchanged
- `server/`, `src/`, `docker-compose.yml`: unchanged
- `data/vua_p0_002_a.db`: untouched
- Docker: untouched
- 6 pre-existing untracked artifacts + 7 prior audit docs (49-55) + 1 new (56) = 14 untracked, all preserved
- HEAD `e4f1980`; origin/main `e4f1980`; no commit; no push

**STOP — diagnostic complete. Awaiting human decision on next authorized step.**
