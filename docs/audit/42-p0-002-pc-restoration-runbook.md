# P0-002 Environment Recovery — PC Restoration Runbook

**Status:** DOCUMENTATION ONLY — Runtime Validation Parked
**Task:** P0-002 Environment Recovery / PC Restoration Runbook
**Document:** `docs/audit/42-p0-002-pc-restoration-runbook.md`
**Date:** 2026-08-31

---

## 1. OBJECTIVE

Create a deterministic recovery procedure for restoring the VUA development environment on a functional PC so that P0-002 can be resumed and validated when the user has access to a suitable machine.

This document is **documentation only**. No source code changes, no architecture changes, no P0-004 implementation.

---

## 2. CURRENT BLOCKER STATUS

**P0-002:** BLOCKED — ENVIRONMENT

**Reason:** Docker daemon cannot initialize in current environment (Android Termux + PRoot-Distro Ubuntu).

**Blocker Class:** Environment / kernel capability limitation — not repository, not architecture, not code.

**Resolution Path:** Requires a functional PC with Docker-capable kernel and network capabilities. Cannot be resolved inside current environment.

---

## 3. CURRENT ENVIRONMENT EVIDENCE

The following evidence establishes that the current environment is not capable of running Docker:

| Symptom | Evidence |
|---------|----------|
| Capability set | CapEff = 0000000000000000 |
| Docker daemon init | Fails to initialize |
| iptables/nft | Permission denied |
| `docker info` | Hangs at "Server:" |
| `docker ps` | Cannot complete successfully |
| Docker Compose | Not available as `docker compose` |
| PostgreSQL runtime | Cannot be validated |

**Conclusion:** Current environment cannot run Docker → cannot run PostgreSQL container → cannot complete P0-002 runtime validation.

**No workaround permitted:** SQLite, fake PostgreSQL, mock DB, fake Prisma, `prisma db push` as migration replacement, synthetic trading data, or any architecture change.

---

## 4. PC PREREQUISITES

The target recovery environment must satisfy the following minimum requirements:

### 4.1 Host OS

- Functional Linux, WSL2, macOS, or Windows with Docker-capable environment
- Kernel and network stack capable of running Docker daemon
- Sufficient permissions to run Docker (non-root with Docker group, or root)

### 4.2 Docker Engine

- Docker Engine installed and daemon running
- Docker CLI functional
- Docker Compose available (`docker compose` V2 plugin or `docker-compose` V1)

### 4.3 Node.js and npm

- Node.js installed (version compatible with `package.json` engines)
- npm installed and functional
- Git installed
- Network access to package registries (registry.npmjs.org and related)

### 4.4 PostgreSQL

- PostgreSQL available through the approved development architecture (Docker Compose service, local install, or equivalent)
- Connection parameters compatible with the existing `DATABASE_URL` pattern

### 4.5 What is NOT required

- Production infrastructure
- Cloud hosting
- Additional services beyond the approved development PostgreSQL
- Any changes to `package.json`, `prisma/schema.prisma`, or `.env.example`

---

## 5. PRE-RECOVERY VERIFICATION

Before beginning the recovery procedure, confirm the following on the target PC:

- [ ] OS/version recorded
- [ ] Docker Engine installed
- [ ] Docker daemon reachable
- [ ] Docker Compose available
- [ ] Node.js installed
- [ ] npm installed
- [ ] Git installed
- [ ] Network connectivity to registry.npmjs.org confirmed
- [ ] Git remote accessible (if pulling repository)
- [ ] Repository cloned and on the correct branch

---

## 6. DOCKER RECOVERY PROCEDURE

### 6.1 Start Docker Daemon

On Linux:
```bash
sudo systemctl start docker
# or if systemctl not available:
sudo dockerd &
```

On WSL2: Docker Desktop for Windows integrated with WSL2, or Docker Engine installed inside WSL2.

On macOS: Docker Desktop started.

On Windows: Docker Desktop started.

### 6.2 Verify Docker Daemon

```bash
docker info
```

**Expected:** `docker info` completes without hanging; output includes Server version, Storage Driver, and other server details; does NOT hang at "Server:".

### 6.3 Verify Docker CLI

```bash
docker ps
```

**Expected:** Returns empty list or existing containers without error; does NOT exit 124 or hang.

### 6.4 Verify Docker Compose

```bash
docker compose version
# or
docker-compose --version
```

**Expected:** Version string printed; command does not error.

### 6.5 Verify Docker Networking

```bash
docker network ls
docker run --rm hello-world
# or other minimal container test
```

**Expected:** Networks listing succeeds; test container starts and stops cleanly.

---

## 7. DOCKER VALIDATION CHECKLIST

| Check | Command | Expected Result | Record |
|-------|---------|-----------------|--------|
| Docker CLI works | `docker --version` | Version string | ✅/❌ |
| Docker daemon reachable | `docker info` | Completes, shows server info | ✅/❌ |
| `docker ps` works | `docker ps` | Completes, no hang | ✅/❌ |
| Docker Compose available | `docker compose version` or `docker-compose --version` | Version printed | ✅/❌ |
| Docker networking works | `docker network ls` + container start test | Networks listed; container starts | ✅/❌ |
| PostgreSQL container can start | `docker compose up -d postgres` (or equivalent) | Container starts and is healthy | ✅/❌ |

**STOP CONDITION:** If any Docker validation fails, STOP. Do not proceed to Node/PostgreSQL validation. Document the failure and report.

---

## 8. NODE / NPM VALIDATION

### 8.1 Verify Node.js

```bash
node --version
```

**Expected:** Version string compatible with project `package.json` engines field.

### 8.2 Verify npm

```bash
npm --version
```

**Expected:** Version string.

### 8.3 Verify npm Registry Connectivity

```bash
npm ping
# or
npm view <some-small-package> version
```

**Expected:** Registry responds; package info retrievable.

### 8.4 Verify Package Installation Capability

```bash
npm install
# or if node_modules already present and lockfile valid:
npm ci
```

**Expected:** Dependencies install without error; `node_modules` populated; no timeout-induced partial install.

**Note:** Do not upgrade dependencies unless explicitly required. Do not modify `package.json` to resolve environment issues. If `npm install` fails due to network/registry, document evidence.

---

## 9. NETWORK / REGISTRY VALIDATION CHECKLIST

| Check | Command | Expected Result | Record |
|-------|---------|-----------------|--------|
| Node version | `node --version` | Version printed | ✅/❌ |
| npm version | `npm --version` | Version printed | ✅/❌ |
| npm registry reachable | `npm ping` or `npm view <pkg> version` | Responds | ✅/❌ |
| npm install works | `npm install` / `npm ci` | Completes, node_modules created | ✅/❌ |

---

## 10. POSTGRESQL VALIDATION (via Docker Compose)

Using the approved development architecture (existing or equivalent `docker-compose.yml` with PostgreSQL service):

### 10.1 Start PostgreSQL Container

```bash
docker compose up -d postgres
# or equivalent command for the project's compose file
```

### 10.2 Verify Container Status

```bash
docker compose ps
docker ps --filter "name=postgres"
```

**Expected:** PostgreSQL container status = healthy/running.

### 10.3 Verify PostgreSQL is Accepting Connections

```bash
docker exec -it <postgres_container> psql -U <user> -d <db> -c "SELECT 1;"
# or use pg_isready
```

**Expected:** `SELECT 1` returns `1`; connection succeeds.

---

## 11. PRISMA VALIDATION

### 11.1 Verify DATABASE_URL

Confirm `.env` or environment variable `DATABASE_URL` is set to a valid PostgreSQL connection string matching the running instance.

### 11.2 Verify Prisma CLI

```bash
npx prisma --version
# or `./node_modules/.bin/prisma --version`
```

**Expected:** Version printed; Prisma CLI functional.

### 11.3 Verify schema.prisma is Valid

```bash
npx prisma validate
# or `npx prisma format` to check syntax
```

**Expected:** No errors; schema parses correctly.

---

## 12. PRISMA MIGRATION VALIDATION

### 12.1 Verify Migration Exists

Confirm `prisma/migrations/` contains the approved migration `20260831000000_p0_002_init` (or the current approved migration).

### 12.2 Apply Migration

```bash
npx prisma migrate deploy
```

**Expected:** Migration applies successfully; no error.

### 12.3 Verify Migration Recorded

```bash
npx prisma migrate status
```

**Expected:** Migration marked as applied.

---

## 13. DATABASE SCHEMA VALIDATION

### 13.1 Verify Tables Exist

Using Prisma or direct SQL, confirm the required tables exist:

- `orders`
- `fills`
- `positions`
- `fill_events`
- `position_events`
- `risk_decisions`
- `reconciliation_events`
- `system_events`
- `system_config`
- (and any other approved entities)

### 13.2 Verify Required Columns

For each required table, confirm the expected columns exist (matching `schema.prisma`).

### 13.3 Verify Foreign Key Relationships

Confirm:
- `fills.order_id → orders.id` (or equivalent FK)
- `positions.order_id → orders.id` (aggregate, not 1:1 replacement of order)
- Any other approved FK relationships

### 13.4 Verify ORDER → FILL (0..N) Relationship

Confirm the schema allows multiple fills per order (0..N). This is the approved model. Do NOT verify or accept a 1:1 ORDER→POSITION replacement.

### 13.5 Verify POSITION is Aggregate

Confirm `positions` represents aggregate current state, not a direct 1:1 copy of an order row.

### 13.6 Verify Append-Only Event Entities

Confirm `fill_events`, `position_events`, `risk_decisions`, `reconciliation_events`, `system_events` (or equivalents) exist as append-only event tables.

### 13.7 Verify client_order_id Idempotency Constraint

Confirm the schema includes the uniqueness constraint on `(client_order_id, exchange, symbol)` or equivalent approved idempotency constraint.

### 13.8 Verify Required Indexes/Constraints

Confirm indexes and constraints that are part of the approved schema exist.

---

## 14. TRANSACTION VALIDATION

### 14.1 Basic Query

```bash
npx prisma ... # or direct SQL
# Query a table, confirm result
```

**Expected:** Query succeeds; returns expected data (or empty set if no data).

### 14.2 Basic Transaction

Execute a minimal transaction:
- Begin transaction
- Insert a test record (if safe to do so in the validation environment)
- Commit
- Query the record back

**Expected:** Transaction commits; record is readable.

### 14.3 Rollback Behavior (if tested)

If tested:
- Begin transaction
- Insert test record
- Rollback
- Confirm record not persisted

**Expected:** Rollback works; no spurious persistence.

**Note:** Test data created during validation should be cleaned up if it is not appropriate to leave in the database.

---

## 15. P0-002 ACCEPTANCE CHECKLIST

P0-002 is **PASS** only when ALL of the following are confirmed by runtime validation evidence:

- [ ] Docker daemon functional
- [ ] Docker Compose functional
- [ ] PostgreSQL starts
- [ ] PostgreSQL connection succeeds
- [ ] Prisma connection succeeds
- [ ] Prisma migration applies successfully
- [ ] Approved schema exists
- [ ] Required entities exist
- [ ] Required FK relationships exist
- [ ] ORDER → FILL (0..N) relationship exists
- [ ] POSITION represents aggregate current state
- [ ] Append-only event entities exist
- [ ] client_order_id idempotency constraint exists
- [ ] Required indexes/constraints exist
- [ ] Basic database query succeeds
- [ ] Basic transaction succeeds
- [ ] No production secrets stored in database
- [ ] No synthetic trading state introduced
- [ ] No downstream P0 task implemented
- [ ] Trader Brain remains disabled
- [ ] Live trading remains disabled

**If ANY item cannot be confirmed, P0-002 remains BLOCKED or PARTIAL — do not claim PASS.**

---

## 16. FAILURE HANDLING

If any validation step fails:

1. **Document the failure.** Record:
   - Exact command executed
   - Exact error output
   - Affected component
   - Severity (BLOCKER / MAJOR / MINOR)
   - Whether the failure is environment-related or repository-related
   - Recommended next diagnostic action

2. **Do NOT fabricate PASS.** If evidence is missing, state that explicitly.

3. **Do NOT use a workaround that changes the approved architecture.** No SQLite substitution, no mock DB, no fake Prisma, no `prisma db push` replacing migration, no synthetic data pretending to be real.

4. **If a new architectural gap is discovered:** Document it first, then report, then STOP. Do not silently implement a fix.

---

## 17. STOP CONDITIONS

STOP the recovery procedure and escalate if:

- Docker daemon cannot start or `docker info` hangs
- PostgreSQL container cannot start or cannot accept connections
- Prisma cannot connect to the database
- Migration fails to apply
- Required schema elements are missing
- Any required entity, FK, constraint, or index is missing
- Any command produces an error that cannot be resolved without architecture change
- A new architectural contradiction is discovered

---

## 18. EVIDENCE TO REPORT AFTER RECOVERY

After completing recovery validation, report the following evidence:

- OS and environment description
- Docker version and `docker info` summary
- `docker ps` output
- Docker Compose version
- Node and npm versions
- npm install result (success/failure + any error)
- PostgreSQL container status
- PostgreSQL connection test result
- Prisma version
- `prisma validate` result
- Migration status (`prisma migrate status`)
- Schema validation evidence (tables, columns, FKs, constraints, indexes)
- Transaction test result
- P0-002 acceptance checklist with ✅/❌ for each item
- Any deviations, warnings, or unresolved issues

---

## 19. DEPENDENCY IMPACT

The current dependency order is:

```
ADR-001 (APPROVED)
  ↓
ADR-002 (APPROVED)
  ↓
P0-002 (BLOCKED — ENVIRONMENT)
  ↓
P0-002 PASS
  ↓
P0-004 implementation planning
  ↓
P0-004 implementation
```

**This order MUST NOT be reordered.**

- P0-004 implementation planning can be refined in parallel as documentation, but P0-004 implementation MUST wait for P0-002 PASS.
- P0-005 and downstream tasks MUST NOT start.
- Trader Brain MUST remain disabled.
- Live trading MUST remain disabled.

---

## 20. NEXT STATE

After this runbook is created:

- P0-002 remains BLOCKED — ENVIRONMENT
- P0-004 readiness audit remains READY WITH BLOCKERS
- P0-004 implementation remains NOT STARTED
- No source code has been modified by this documentation task
- No architecture has been changed
- Recovery must be performed on a functional PC when available

---

## 21. SOURCE PROTECTION VERIFICATION

Before creating this document:
- Git status was inspected (see earlier session evidence).

After creating this document:
- Git status confirms only documentation addition under `docs/audit/`.
- No `server/`, `src/`, `package.json`, `prisma/schema.prisma`, `bun.lock`, `docker-compose.yml`, `.env`, or `.env.example` modifications introduced by this task.

**Source code unchanged. Architecture unchanged. No unauthorized changes.**

---

## 22. REFERENCE DOCUMENTS

- `docs/audit/34-p0-002-postgresql-implementation.md`
- `docs/audit/35-p0-002-environment-blocker-checkpoint.md`
- `docs/audit/29-adr-002-database-review.md`
- `docs/audit/30-adr-002-correction-review.md`
- `docs/audit/32-adr-002-finalization.md`
- `docs/audit/27-vua-master-project-map.md`
- `docs/audit/25-master-work-breakdown.md`
- `docs/audit/24-engineering-dependency-order.md`
- `docs/audit/28-health-gates.md`

---

## 23. FINAL STATUS

| Item | State |
|------|-------|
| **TASK** | P0-002 Environment Recovery Runbook — DOCUMENTATION ONLY |
| **DOCUMENT CREATED** | `docs/audit/42-p0-002-pc-restoration-runbook.md` |
| **DOCUMENT MODIFIED** | None |
| **SOURCE CODE MODIFIED** | None |
| **ENVIRONMENT BLOCKER** | P0-002 BLOCKED — ENVIRONMENT (Docker daemon not functional in current PRoot-Distro) |
| **DOCKER REQUIREMENT** | Functional Docker Engine + Docker Compose + working networking |
| **P0-002 RUNTIME REQUIREMENT** | PostgreSQL container reachable + Prisma + migration applied + schema validated |
| **P0-002 ACCEPTANCE STATE** | BLOCKED — ENVIRONMENT; acceptance checklist defined but not validated |
| **NEW GAPS** | None discovered by this documentation task |
| **DEPENDENCY IMPACT** | None; dependency order preserved |
| **NEXT ACTION** | Wait for functional PC environment; then follow this runbook to restore and validate P0-002 |
| **TRADER BRAIN** | DISABLED |
| **LIVE TRADING** | DISABLED |

---

**STOP.**
