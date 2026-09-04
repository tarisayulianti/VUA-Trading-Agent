# P0-002 — PostgreSQL + Prisma Runtime Handoff Package

**Task:** TASK-P0-002
**Status:** BLOCKED — ENVIRONMENT (runtime validation not executed)
**Date:** 2026-09-01
**Role:** Principal Engineer ONLY
**Trader Brain:** DISABLED
**Live Trading:** DISABLED

---

## 1. CURRENT P0-002 STATUS

- **Design:** COMPLETE
  - Canonical Prisma schema exists: `prisma/schema.prisma` (11 models, PostgreSQL provider)
  - Docker Compose file exists: `docker-compose.yml` (PostgreSQL 16 service)
  - Prisma config for Profile B exists: `prisma.config.postgres.ts`
  - Migration artifacts exist under `prisma/migrations/`
  - ADR-002 APPROVED: Dual-Profile (Profile A SQLite / Profile B PostgreSQL 16)

- **Runtime:** NOT VALIDATED
  - PostgreSQL 16 is not running in this environment
  - Prisma Client has not been generated against a live PostgreSQL instance
  - Migrations have not been applied in this environment
  - CRUD / transaction / restart persistence have not been executed

- **Source integration:** NOT STARTED
  - `server/services/*` does not import or use Prisma Client
  - `executionEngine.ts`, `riskEngine.ts`, `memoryLedger.ts` remain in-memory only
  - `api.ts` module-level state is not backed by `system_config` table

- **Overall P0-002 status:** BLOCKED — ENVIRONMENT

---

## 2. WHY THE CURRENT PROOT/ARM64 ENVIRONMENT IS INSUFFICIENT

Observed limitations:
- Docker daemon is unreachable in PRoot (`docker info` hangs; `docker ps` exits 124)
- Docker Compose plugin cannot be exercised because the daemon is unavailable
- Prisma CLI cannot complete its lifecycle in PRoot/ARM64 (exit 124 / timeout)
- No PostgreSQL container or native service can be started from this session

These are environmental constraints, not configuration errors. No workaround is authorized for P0-002 runtime validation.

---

## 3. REQUIRED NATIVE ENVIRONMENT

The receiving environment must satisfy ALL of the following:

| Requirement | Specification |
|-------------|---------------|
| OS | Native Linux x86_64/aarch64, WSL2, macOS Intel/Apple Silicon |
| Node.js | 24 LTS or 26 LTS |
| npm/pnpm | pnpm 9.15.0+ or npm compatible with `package.json`/lockfiles |
| Prisma | 7.10.0 CLI executable to completion |
| PostgreSQL | 16.x running and reachable at `DATABASE_URL` |
| Docker | Docker Engine 24+ with Compose v2 (preferred) OR native PostgreSQL service |
| Network | Registry access for dependency installation if `node_modules` absent |
| Filesystem | Normal process termination and syscall behavior (no PRoot emulation) |

---

## 4. PREREQUISITES BEFORE RUNTIME HANDOFF

1. Copy the repository to the native environment preserving git history
2. Confirm git status matches expected checkpoint state
3. Ensure no secrets are present in `.env` beyond placeholders/testnet values
4. Ensure `docker-compose.yml` is present and unmodified
5. Ensure `prisma/schema.prisma`, `prisma/migrations/`, and `prisma.config.postgres.ts` are present
6. Confirm `package.json`/lockfile state is consistent with chosen package manager

---

## 5. EXACT RUNTIME VALIDATION SEQUENCE

Execute the following steps in order. Do not skip. Capture terminal output for each step.

### 5.1 Environment Checks
```bash
node --version
npm --version
pnpm --version || true
docker --version || true
docker compose version || true
git status --short
git rev-parse --show-toplevel
```

### 5.2 Docker / PostgreSQL Startup
```bash
docker compose up -d postgres
docker compose ps
docker compose logs --tail=100 postgres
pg_isready -U postgres -d vua_trading || true
psql -U postgres -d vua_trading -c '\conninfo' || true
```

### 5.3 Prisma Generation
```bash
pnpm install || npm install
npx prisma generate --config prisma.config.postgres.ts
npx prisma validate --config prisma.config.postgres.ts
```

### 5.4 Migration
```bash
npx prisma migrate deploy --config prisma.config.postgres.ts
npx prisma migrate status --config prisma.config.postgres.ts
```

### 5.5 Schema / Table Verification
```bash
psql -U postgres -d vua_trading -c "\dt"
psql -U postgres -d vua_trading -c "
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
"
```

### 5.6 CRUD Verification
Execute a representative CRUD sequence using Prisma Client against:
- `system_config`
- `decisions`
- `orders`
- `fill_events`
- `positions`
- `risk_decisions`
- `reconciliation_events`
- `system_events`
- `market_data_candles`

Record created row IDs and query results.

### 5.7 Transaction Verification
```bash
# COMMIT path
<execute transaction creating order + risk_decision + fill_event; commit>
<verify rows persisted>

# ROLLBACK path
<execute transaction inserting decision + order; throw inside $transaction>
<verify no rows persisted for that transaction>
```

### 5.8 Persistence / Restart Recovery
```bash
# Write known data
# Stop PostgreSQL container/service
# Start PostgreSQL container/service
# Reconnect and verify data intact and FK integrity preserved
```

---

## 6. FAILURE CLASSIFICATION

| Failure | Classification | Action |
|---------|----------------|--------|
| Docker daemon unavailable | BLOCKED — ENVIRONMENT | Halt handoff; cannot start PostgreSQL |
| Docker Compose fails | BLOCKED — ENVIRONMENT | Check Docker Engine version; do not attempt runtime DB workaround |
| PostgreSQL container exits unhealthy | BLOCKED — ENVIRONMENT | Inspect logs; fix PostgreSQL config on native host |
| Prisma install fails | BLOCKED — ENVIRONMENT | Verify registry access; do not fake client |
| Prisma generate fails | BLOCKED — CONFIG/SCHEMA | Fix schema/config; do not bypass |
| Migration fails | BLOCKED — MIGRATION | Fix migration SQL; do not use `db push` unless explicitly authorized |
| CRUD fails | BLOCKED — VALIDATION | Diagnose schema/permissions; do not fake success |
| Transaction rollback fails | BLOCKED — VALIDATION | Diagnose Prisma transaction boundaries; do not proceed |
| Restart persistence fails | BLOCKED — VALIDATION | Inspect volumes/permissions; do not claim PASS |

---

## 7. PASS CRITERIA

P0-002 PASS requires ALL of the following evidence:
1. PostgreSQL 16 running and `pg_isready` returns 0
2. `psql` connection with `DATABASE_URL` succeeds
3. `prisma generate` completes without error
4. `prisma validate` returns schema valid
5. `prisma migrate deploy` applies all migrations
6. `\dt` shows all expected tables
7. CRUD succeeds for representative entities listed in 5.6
8. Transaction COMMIT persists data
9. Transaction ROLLBACK removes uncommitted data
10. Data survives PostgreSQL restart
11. FK/UNIQUE/index constraints enforce correctly
12. No secrets committed or exposed in logs
13. No fake DB, mock client, or synthetic validation substituted

---

## 8. EVIDENCE REQUIRED BEFORE DECLARING PASS

- Terminal output for every command in section 5
- `psql` table list
- Prisma generate/validate logs
- Migration apply/status logs
- CRUD query results with row IDs
- Transaction commit/rollback before/after counts
- Restart recovery query results
- Git status showing no unauthorized source changes

---

## 9. NEXT GATE

After P0-002 PASS on native environment:
- Proceed to P0-002 runtime integration: wire Prisma Client into `server/services/*`
- Then proceed to P0-003 formal validation with automated tests
- Then P0-004 exchange abstraction implementation

STOP.
WAIT FOR NEXT INSTRUCTION.
