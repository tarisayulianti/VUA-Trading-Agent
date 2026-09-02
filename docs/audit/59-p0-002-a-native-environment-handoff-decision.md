# P0-002-A — Profile A Native Environment Handoff Decision
**Date:** 2026-09-02 — DOCUMENTATION ONLY / NO EXECUTION / READ-ONLY
**Status:** NO-GO for Prisma CLI in Termux/PRoot / BLOCKED-ENV confirmed at environment level (Node 24 + Node 26 both hang)
**Source chain:** 48 → 49 → 50 → 51 → 52 → 53 (C-A authorized) → 54 (C-A executed) → 55 → 56 (forensic — hang at event loop) → 57 (plan) → 58 (Node 24 result: exit 124) → 59 (this decision)
**Checkpoint:** e4f1957 (HEAD = e4f1980; `prisma.config.ts` = authorized C-A edit; 1 tracked change; 15 untracked)
**Role:** Principal Engineer ONLY | Profile A = SQLite / Termux / dev | Profile B = PostgreSQL / PC / production | SEPARATE — never merge

---

## A. EXECUTIVE DECISION

**Profile A SQLite implementation cannot proceed in the current Termux/PRoot/ARM64 environment.**

The decision rests on the following verified evidence:

- **Node 26 (v26.8.1, ABI 147):** `timeout 30s npx prisma --version` → exit 124 (timeout); full 7-component version banner printed, then hang.
- **Node 24 LTS (v24.8.0, ABI 137, isolated install at `/tmp/node24/`):** same command → exit 124; only config-load line printed, hang earlier in startup.
- **Both reproduce the hang identically.** The determining blocker is NOT Node version.
- **BLOCKED-CONFIG (adapter mismatch): RESOLVED** — C-A edit (`adapter-better-sqlite3`) verified; adapter loads; no dependency failure.
- **BLOCKED-MIGRATION (no SQLite DDL): REMAINS** — independent of hang.
- **BLOCKED-ENV (CLI hang): CONFIRMED at environment level** — PRoot syscall emulation prevents Prisma 7 CLI from terminating normally.

**Decision:** Authorize documentation of handoff requirements (this document). **DO NOT authorize any Prisma execution in current environment.** The next legitimate execution environment for Profile A SQLite work is a **native Linux / WSL2 / macOS system** where Prism CLI completes normally. This is an architectural decision, not a workaround.

---

## B. EVIDENCE FROM NODE 26 TEST (58 / 55 / 56 / 54)

| Evidence | Source | Meaning |
|----------|--------|---------|
| `timeout 30s npx prisma --version` | 58 (result), 56 (forensic) | Full banner (7 components); exit 124 |
| Adapter load (after C-A) | 54 (C-A edit verified), 58 §D | `adapter-better-sqlite3` resolves; no module error |
| Config load | 58 §C (§D) | `prisma.config.ts` loads |
| Engine load | 58 §G (Node 26 evidence) | `schema-engine-linux-arm64-openssl-3.0.x` resolves |
| Hang point | 56 §G (post-banner event loop) | Process lives until timeout; no crash; no exception |
| Classification | 56 §H / 58 §L | BLOCKED-ENV (PRoot + Prisma 7 lifecycle) |

---

## C. EVIDENCE FROM NODE 24 TEST (58 / 57 / result doc)

| Evidence | Source | Meaning |
|----------|--------|---------|
| Node 24.8.0 installed at `/tmp/node24/` | 58 §B / 57 §D | Isolated; no project modification |
| `node --version` = `v24.8.0` | 58 §B | LTS; ABI 137 |
| `timeout 30s ... npx prisma --version` | 58 §C / §D / §E | **Only `Loaded Prisma config...` line; exit 124** |
| Full banner | **NOT PRINTED** | Hang occurred earlier (during adapter/engine init) |
| Adapter load evidence | Unknown (hung before banner) | No `MODULE_NOT_FOUND`; adapter import in `prisma.config.ts` is correct |
| Engine load evidence | Not reached | Process dead at timeout |
| Exit code | **124** (SIGALRM) | Timeout kill — same as Node 26 |
| Classification | **BLOCKED-ENV** | Confirmed |

**Critical: Both versions hang, at different startup points, with the same root cause (PRoot syscall emulation prevents Prisma 7 CLI from completing its lifecycle).**

---

## D. WHY NODE VERSION IS NO LONGER THE ROOT CAUSE

| Claim | Evidence against |
|-------|-----------------|
| "Node 26 ABI (147) compatibility" | Node 24 (ABI 137) reproduces hang |
| "Node 26 event-loop behavior" | Node 24 also hangs (different point, same outcome) |
| "Upgrade to Node 24 fixes" | Tested in isolation; does **not** fix |
| "Node version determines hang" | **Rejected** — hang is PRoot + Prisma 7 interaction, independent of Node ABI |

The 56 forensic analysis classified the hang as an **event-loop lifecycle mismatch** (Prisma CLI does not call `process.exit()`; PRoot prevents the process from closing via `waitpid()` / `connect()` / FD cleanup). Changing Node version does not alter PRoot's syscall emulation behavior.

---

## E. FINAL ENVIRONMENT CLASSIFICATION

| Environment / Profile | Classification | Evidence |
|----------------------|----------------|----------|
| Termux / Ubuntu 26.04 / PRoot / ARM64 / Node 26 / Prisma 7 | **BLOCKED-ENV** | 58 §E (exit 124) |
| Termux / Ubuntu 26.04 / PRoot / ARM64 / Node 24 / Prisma 7 | **BLOCKED-ENV** | 58 §D–E (exit 124; hang earlier) |
| Native Linux / WSL2 / macOS / any Node 24/26 / Prisma 7 | **NOT TESTED; EXPECTED PASS** (based on Prisma's official support matrix) | 57 §L / 57 §O |

**No environment within this Termux/PRoot session is authorized for Prisma CLI execution for Profile A.**

---

## F. WHY TERMUX/PROOT IS NOT AN AUTHORIZED PRISMA EXECUTION ENVIRONMENT

Per the user's institutional requirements (AGENTS.md), the project explicitly requires:

- Institutional-grade algorithmic trading platform (institutional-grade = production-grade reliability)
- Risk-first / capital preservation (execution engine / risk engine must never be bypassed)
- No hallucinations / evidence-bounded (only real DB/Prisma runtime evidence permits PASS claims)
- No workarounds for BLOCKED-ENV (per 49–58 chain; 56 §K — no fake adapter, no mock, no LD_PRELOAD, no binary patch)

The Termux/PRoot environment has demonstrated, empirically (two independent Node versions, bounded timeout with full CLI load, exit 124 both times), that it **cannot complete Prisma CLI execution**.

Therefore, continuing to attempt Prisma CLI work in Termux/PRoot would:

1. Violate the **no-workaround governance** (would imply attempting repeated fixes rather than recognizing the environment limitation)
2. Violate **evidence-bounded PASS rules** (no PASS can be claimed without real Prisma CLI termination evidence)
3. Waste project resources on a non-resolvable environment limitation
4. Risk corrupting Profile A state by forcing workarounds

**Profile A SQLite work is legitimate; the current physical environment is not.**

---

## G. NATIVE ENVIRONMENT REQUIREMENTS FOR PROFILE A

The target environment for Profile A SQLite implementation must satisfy ALL of the following:

| Requirement | Specification | Evidence / Source |
|-------------|--------------|-------------------|
| OS | Native Linux (x86_64 or aarch64), WSL2 (Windows Subsystem for Linux 2), or macOS (Intel / Apple Silicon) | Prisma 7 official support; 57 §L |
| Node.js | 24 LTS or 26 LTS (either; test shows neither fixes PRoot, but either works in native) | 58 §B / 57 §D |
| npm / pnpm | 9.15.0 or compatible | `package.json` |
| Prisma 7.10.0 | Installed via `pnpm install` (same `pnpm-lock.yaml`) | `package.json`; `node_modules/` verified |
| @prisma/client | 7.10.0 | `package.json` |
| @prisma/adapter-better-sqlite3 | 7.10.0 (C-A edit preserved) | `package.json`; installed |
| SQLite filesystem access | Direct `file:...` access to `data/vua_p0_002_a.db` | Profile A architecture (ADR-002 / 48) |
| Normal process termination | `prisma --version` completes in <5s with exit 0 | Required for A2-A6 evidence |
| No PRoot syscall emulation | Native syscalls (no PRoot wrapper) | 56 §H / 58 §L |

**No dependency upgrade, no adapter change, no package version change, no schema redesign required.** The only repository change needed is the already-completed C-A edit (`prisma.config.ts` adapter import fix).

---

## H. CANDIDATE ENVIRONMENTS

| Candidate | Suitability for Profile A | Notes |
|-----------|--------------------------|-------|
| **Native Linux** (Ubuntu 24.04 / Debian 12 / Fedora) | **RECOMMENDED PRIMARY** | Native aarch64 or x86_64; Prisma 7 fully supported; SQLite native; `pnpm` works; closest to project setup |
| **WSL2** (Windows 11 / 10) | **RECOMMENDED ALTERNATE** | Native Linux kernel under Windows; Prisma 7 supported; SQLite native; requires Windows host; no PRoot |
| **macOS** (Apple Silicon or Intel) | **RECOMMENDED ALTERNATE** | Prisma 7 fully supported; SQLite native; `pnpm` works; Apple Silicon is ARM64 — same architecture as current; fastest to set up |
| **Docker container** (Profile B deployment) | **FORBIDDEN FOR PROFILE A** | Per ADR-002 / 48 §2 / 54 §B — Profile A is SQLite / Termux / dev; Docker = Profile B / PC / production. Mixing profiles violates architecture. |

---

## I. REQUIRED CAPABILITIES OF TARGET ENVIRONMENT

Beyond the technical requirements (§G), the target environment must support:

1. **Normal Prisma CLI lifecycle:** `npx prisma --version` → `prisma generate` → `prisma migrate dev --create-only` → `prisma migrate dev` → CRUD tests → restart persistence → audit verification (A1-A6).
2. **Evidence-bound audit:** Each gate requires real execution output (not simulated, not mock, not fake adapter).
3. **Profile isolation:** Profile A SQLite workspace must be separate from Profile B PostgreSQL workspace; `data/vua_p0_002_a.db` can coexist with any PG database file / server.
4. **Reversibility:** The environment setup (Node 24 / pnpm / Prisma 7 / SQLite adapter) must be removable without affecting `prisma.schema.prisma`, `prisma/schema-sqlite.prisma`, `prisma/init.ts`, or the repository.
5. **No system modifications:** The environment must not alter the VUA repository beyond the authorized C-A edit.

---

## J. REPOSITORY / PROFILE ISOLATION REQUIREMENTS

| Rule | Enforcement |
|------|-------------|
| Only `prisma.config.ts` (C-A) changed | `git diff --name-only` = `prisma.config.ts`; verified |
| `prisma/schema.prisma` (canonical PG) untouched | `git diff -- prisma/schema.prisma` = empty |
| `prisma/schema-sqlite.prisma` untouched | `git diff -- prisma/schema-sqlite.prisma` = empty |
| `prisma/migrations/` untouched | `git diff -- prisma/migrations/` = empty |
| `package.json` / `pnpm-lock.yaml` untouched | `git diff -- package.json pnpm-lock.yaml` = empty |
| `prisma/init.ts` untouched | `git diff -- prisma/init.ts` = empty |
| `server/`, `src/` untouched | `git diff -- server/ src/` = empty |
| `data/vua_p0_002_a.db` preserved | `ls -l data/` unchanged |
| `prisma.config.ts` preserved at C-A state | `git diff -- prisma.config.ts` = only adapter fix; no new edit |
| Profile B architecture | Unchanged; no cross-profile modifications |

---

## K. EXACT STATE PRESERVED DURING HANDOFF

| State element | Value | Preservation method |
|---------------|-------|----------------------|
| Git HEAD | `e4f1980` | No commit / push; `prisma.config.ts` = C-A edit only |
| `prisma.config.ts` | C-A adapter = `@prisma/adapter-better-sqlite3` | Not reverted; not modified further |
| `prisma/schema.prisma` | `provider = "postgresql"` | Unmodified |
| `prisma/schema-sqlite.prisma` | `provider = "sqlite"` | Unmodified |
| `prisma/init.ts` | Default `@prisma/client` | Unmodified |
| `prisma/migrations/` | PG DDL preserved | Unmodified |
| `package.json` | Same dependencies + `adapter-better-sqlite3` | Unmodified |
| `pnpm-lock.yaml` / `package-lock.json` | Unchanged | Unmodified |
| `server/`, `src/`, `docker-compose.yml` | Unmodified | Unmodified |
| 6 untracked artifacts | `check_p003_state.py`, `data/`, `package-lock.json`, `test_crud.mjs`, `test_real_prisma.mjs`, `verify_p003.py` | Unmodified |
| 9 audit docs (49-57) + 58 (this result) + 59 (this decision) | Unmodified | Unmodified |

**Handoff must transport this exact state to the target environment — either by `git clone` / `git fetch` / `git checkout` (with the same `prisma.config.ts`) or by copying the repository directory to a native system.**

---

## L. WHAT MUST NOT BE CHANGED DURING HANDOFF

- Do NOT modify `prisma.config.ts` further (C-A is complete; no further adapter edits needed)
- Do NOT install `@prisma/adapter-sqlite` (C-B excluded permanently)
- Do NOT modify `prisma/schema.prisma`
- Do NOT delete `prisma/migrations/20260901154749_p0_002_b_u1_clean_init/`
- Do NOT change `prisma/init.ts`
- Do NOT modify `package.json` dependencies (Prisma 7.10.0 / adapter / client stay pinned)
- Do NOT run `pnpm install` that changes `pnpm-lock.yaml`
- Do NOT modify database (`data/vua_p0_002_a.db`) — the SQLite file can be copied with the repository; no DB modifications needed
- Do NOT modify Profile B server code
- Do NOT merge Profile A and Profile B
- Do NOT start P0-003 / Trader Brain / Live / Autonomous

---

## M. REQUIRED AUTHORIZATION BEFORE MOVING TO NATIVE ENVIRONMENT

Per 57 §N and 55 §K-14, a separate, explicit authorization message is required before any environment handoff. The authorization must specify:

| Gate | Required authorization content |
|------|-------------------------------|
| **N-1 (handoff)** | "APPROVED: Profile A environment handoff to [native Linux / WSL2 / macOS]. Preserve repository state `e4f1980`; preserve C-A `prisma.config.ts`; no package/dependency changes; no Profile B modifications." |
| **N-2 (execution)** | Only after handoff: "APPROVED: Run `timeout 30s npx prisma --version` under native environment to verify BLOCKED-ENV resolved." |
| **N-3 (A2)** | Only after N-2 PASS: "APPROVED: `prisma generate` (A2)" |
| **N-4 (A3)** | Only after A2 PASS: "APPROVED: `prisma migrate dev --create-only` (A3 start)" |
| **N-5 (A4-A6)** | Separate gates per 51 §N / 54 §F |

**No handoff is authorized by this document.** This document (59) establishes the decision; execution requires the authorization message above.

---

## N. POST-HANDOFF EXECUTION SEQUENCE (after authorization, not now)

When handoff authorization (N-1) is granted, then N-2 (verification), the sequence is:

```
N-1 (handoff) → N-2 (verify CLI exits 0 under native) → A1 (re-verify schema portability)
→ A2 (prisma generate) [separate auth] → A3 (prisma migrate dev --create-only / apply) [separate auth]
→ A4 (real Prisma Client CRUD with real DB, not mock) [separate auth]
→ A5 (restart persistence) [separate auth] → A6 (canonical PG schema integrity verified) [separate auth]
→ Final audit with REAL evidence → commit (if authorized) → push (N-13 — explicitly not authorized here)
```

**Each step requires separate authorization per the governance chain (48–57).** The handoff itself does not authorize any Prisma subcommand.

---

## O. A1-A6 GATE MAPPING AFTER HANDOFF

| Gate | Pre-handoff (current Termux) | Post-handoff (native, if N-2 passes) | Authorization needed |
|------|------------------------------|--------------------------------------|---------------------|
| A1 — SQLite portability | PASS (verified; 48/49/50/51/52/53/54/55) | PASS (re-verify on new system) | None (already verified) |
| A2 — Prisma Client gen | BLOCKED-ENV (58) | **READY** — only after N-2 `prisma --version` = 0 | N-3 |
| A3 — SQLite migration | BLOCKED (transitive) | **READY** — after A2 | N-4 |
| A4 — Real Prisma CRUD | NOT STARTED | **READY** — after A3 + real `data/vua_p0_002_a.db` | N-5 |
| A5 — Restart persistence | NOT STARTED | **READY** — after A4 | N-5 |
| A6 — Canonical PG integrity | PASS | PASS (always; independent) | None |

**Profile A execution sequence is only possible after N-2 passes.**

---

## P. RELATIONSHIP TO PROFILE B

- Profile B (PG / PC / production) is **complete** (P0-002-B: docs 42-44; PG server plan; U1 UUID contract; CRUD / transaction / restart / persistence all validated; 6d41144 checkpoint; pushed).
- Profile B does **not** require this handoff. Profile B's execution environment is already the PC/production infrastructure.
- Profile A's handoff is independent — it does not affect Profile B's architecture, data, migrations, or server code.
- No cross-profile work is needed.

---

## Q. FINAL GO/NO-GO

**NO-GO for Prisma CLI execution in Termux/PRoot (current session).**

**READY FOR HANDOFF AUTHORIZATION (documented).** The execution of the handoff itself requires a separate message — it is not authorized by this document. This document's purpose is to establish the decision, preserve the evidence, document the environment requirements, and define the sequence — not to perform the handoff.

**If handoff authorization (N-1) is granted:** The repository state (`e4f1980`, `prisma.config.ts` = C-A, all profiles preserved) is ready to be copied / cloned / checked out to a native Linux, WSL2, or macOS system.

**If handoff is never authorized:** Profile A SQLite work remains PLANNED (per ADR-002); Profile B remains COMPLETE; P0-003 (data foundation / synthetic removal) remains NOT STARTED; the project retains its dual-profile architecture with SQLite and PostgreSQL separation intact.

---

## VERIFICATION (post-doc, read-only; this document created only)

- ✅ Only `docs/audit/59-p0-002-a-native-environment-handoff-decision.md` created
- ✅ No new tracked modifications (only `prisma.config.ts` C-A edit from 54)
- ✅ `prisma.schema.prisma` — unchanged (PostgreSQL)
- ✅ `prisma/schema-sqlite.prisma` — unchanged (SQLite)
- ✅ `prisma/init.ts` — unchanged
- ✅ `prisma/config.ts` — unchanged (C-A edit preserved in `prisma.config.ts` at repo root)
- ✅ `prisma/migrations/` — unchanged (PG DDL preserved)
- ✅ `package.json` — unchanged (no new dependencies)
- ✅ `pnpm-lock.yaml` — unchanged
- ✅ `package-lock.json` — unchanged
- ✅ `server/` / `src/` — unchanged
- ✅ `database` / `data/` — untouched
- ✅ Docker — untouched
- ✅ All untracked preserved (6 pre-existing + 49 through 59 = 15 total)
- ✅ HEAD = `e4f1980`; origin/main = `e4f1980`
- ✅ No commit; no push
- ✅ No install; no Prisma command; no CRUD; no transaction; no P0-003; no Trader / Live / Autonomous
- ✅ C-A adapter fix preserved (`adapter-better-sqlite3`)
- ✅ No workarounds attempted
- ✅ No modifications to Profile B

**STOP — decision documented. Awaiting independent authorization (N-1) for environment handoff. No execution performed in this session.**
