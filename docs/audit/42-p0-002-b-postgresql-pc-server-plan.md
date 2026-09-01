# P0-002-B — PostgreSQL Profile B — PC/Server Implementation Plan

Status: PLANNED — NOT YET VALIDATED (ready for PC/server execution; documentation only)
Date: 2026-09-01
Role: Principal Engineer ONLY
Scope: PostgreSQL Profile B ONLY (Profile A SQLite runtime already validated; P0-002-A = PASS)

---

## 1. Runtime Architecture (Profile B)

```
Profile B — PC / Server (production)
          ↓
Node 26 (default runtime) [REQUIRED]
          ↓
Prisma 7.10.0 [LOCKED]
          ↓
PostgreSQL 16 [REQUIRED]
          ↓
Production persistence layer
```

Canonical Prisma schema source of truth: `prisma/schema.prisma` (untouched; P0-002-B uses this exact schema). The SQLite-adapted `prisma/schema-sqlite.prisma` is Profile A only and remains excluded from this work.

---

## 2. PostgreSQL 16 Requirements

- PostgreSQL 16.x (latest 16 minor: 16.4 or 16.5)
- Default isolation level: READ COMMITTED
- Standard extensions required: `pgcrypto` (UUID generation), optionally `citext` (case-insensitive text)
- Charset: `UTF8` / `en_US.utf8` collate
- Roles: dedicated `vua_app` role for application; separate `vua_migrate` role for Prisma migrate
- Connection limit: ≥ 100 (default 100)
- `log_min_duration_statement = 1000ms` (slow query log)
- `shared_buffers`: 25% of RAM
- `effective_cache_size`: 50% of RAM
- `work_mem`: 32MB
- `maintenance_work_mem`: 256MB

---

## 3. Recommended PC/Server Environment

| Aspect | Minimum | Recommended |
|--------|---------|-------------|
| OS | Linux x86_64 (Ubuntu 22.04 LTS or Debian 12) | Ubuntu 24.04 LTS server |
| Architecture | x86_64 (or arm64 with PG binaries) | x86_64 |
| CPU | 2 vCPU | 4+ vCPU |
| RAM | 4 GB | 8+ GB |
| Storage | 20 GB SSD | 100 GB NVMe SSD (with daily backup) |
| Networking | 100 Mbps | 1 Gbps internal |
| Persistent Volume | Docker volume `vua_pg_data` | Named volume + off-host backup |
| Docker | Docker Engine 24+ with Compose v2 | Docker 25+ with Compose v2.21+ |

---

## 4. Deployment Strategy

### Primary: Docker Compose + PostgreSQL 16

```yaml
# docker-compose.yml (Profile B — to be created when execution authorized)
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: vua_production
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=en_US.utf8"
    ports:
      - "5432:5432"
    volumes:
      - vua_pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d vua_production"]
      interval: 10s
      timeout: 5s
      retries: 5
volumes:
  vua_pg_data:
```

`vua_pg_data` is the persistent volume. **No** data is committed to git; credentials are loaded from `.env` (not committed).

### Fallback: Native PostgreSQL 16 (apt install postgresql-16)

Used only if Docker is unavailable on the target host. Install via PostgreSQL Apt Repository (PGDG). Data directory: `/var/lib/postgresql/16/main`. Service managed by `systemd` unit `postgresql.service`. **Not preferred** because it complicates the recovery procedure and bypasses the reproducible Docker Compose workflow validated by other engineering teams.

---

## 5. DATABASE_URL Strategy

All credentials loaded from `.env` (gitignored). `.env.example` carries placeholder values only. Roles are split per environment.

### Development

```
DATABASE_URL="postgresql://vua_dev:CHANGE_ME@localhost:5432/vua_dev?schema=public"
```

### Test

```
DATABASE_URL="postgresql://vua_test:CHANGE_ME@localhost:5432/vua_test?schema=public"
```

### Production

```
DATABASE_URL="postgresql://vua_app:CHANGE_ME@db.internal:5432/vua_production?schema=public&sslmode=require&connection_limit=10"
```

**Rules (FORBIDDEN):**
- No credentials in source code, schema, or commit history.
- No credentials in `.env.example` (placeholders only).
- No credentials in markdown documentation files.
- `connection_limit` set per environment to prevent DB overload.

---

## 6. Prisma PostgreSQL Validation Sequence

Mandatory step-by-step validation when execution is authorized on a PC/server host:

```
1. PostgreSQL runtime    →  docker compose up -d postgres
2. connection             →  psql -U vua_dev -d vua_dev -c '\conninfo'
3. migration              →  npx prisma migrate deploy (production) OR
                              npx prisma migrate dev (development)
4. Prisma Client          →  npx prisma generate
5. schema validation      →  npx prisma validate
6. CRUD                   →  Prisma Client create / read / update / delete
                              on representative entities
7. FK / UNIQUE / INDEX    →  Prisma Client enforces; verify rejection of
                              invalid FK references and duplicate unique
8. transaction            →  prisma.$transaction([...]); verify COMMIT
9. rollback               →  throw inside $transaction; verify ROLLBACK
                              removed all intermediate writes
10. persistence           →  write data → terminate Node process →
                               reconnect → confirm data still present
11. restart recovery      →  docker compose restart postgres →
                               reconnect via Prisma → confirm no
                               data loss and FK integrity preserved
```

Each step must be evidence-backed: command output captured, no claim without actual terminal result. Per P0-002-A evidence discipline: no PASS without a real `psql` connection and a real `prisma migrate` log.

---

## 7. Canonical Schema Verification

Canonical `prisma/schema.prisma` is the PostgreSQL source of truth. Profile B validation will use this schema unchanged. Verification before any execution:

- `datasource db { provider = "postgresql" }` — confirmed in existing canonical schema.
- `url = env("DATABASE_URL")` — confirmed; no hardcoded connection.
+- Note for Prisma 7+: the canonical PostgreSQL schema no longer carries `url = env("DATABASE_URL")`; the connection URL is provided through the Prisma config layer, while the schema remains the source of truth for models, relations, and constraints.
- 11 core entities (User, SystemConfig, MarketData, Order, Fill, Position, RiskDecision, ExecutionLog, Reconciliation, AgentDecision, ExchangeConnection) — confirmed.
- ORDER → FILL (0..N) → POSITION relationship — confirmed in canonical.
- Decimal precision handled by `Decimal` columns — confirmed.

**No schema modification is authorized during P0-002-B.** Profile A's SQLite-adapted `prisma/schema-sqlite.prisma` is a Profile A artifact only and is explicitly excluded from this task.

### 7.1 UUID Contract Note

The initial Option B authorization addressed only `decisions.id` UUID typing. A subsequent complete PK/FK forensic audit (`docs/audit/44-p0-002-b-u1-full-uuid-contract-authorization.md`) determined that the intended PostgreSQL contract is **U1 — Full UUID Contract**: all UUID-like primary keys and foreign keys must use PostgreSQL `uuid`. Implementation of U1 requires separate explicit human authorization and is not covered by the original Option B scope alone.

---

## 8. ADR-002 Reconciliation

ADR-002 (Database) approved dual-profile architecture. Reconciliation:

| Aspect | Profile A (SQLite) | Profile B (PostgreSQL) |
|--------|--------------------|-----------------------|
| Status | **PASS** (P0-002-A validated) | **PLANNED** (P0-002-B; awaiting PC execution) |
| Prisma schema | `prisma/schema-sqlite.prisma` (adapter-stripped) | `prisma/schema.prisma` (canonical; PG-native) |
| Adapter | `@prisma/adapter-better-sqlite3` + `better-sqlite3` | `prisma-client-js` (no adapter; native PG driver) |
| Node runtime | Node 24 LTS (isolated) | Node 26 (default) |
| Deployment | Single Android device | PC/server with Docker |
| Migration | Adapter-driven `migrate dev` | Standard `migrate deploy` |
| Use case | Local dev / smoke test on Android | Production persistence |
| Persistence file | `data/vua_p0_002_a.db` (16 KB) | Docker volume `vua_pg_data` |

ADR-002 is APPROVED. P0-002-A and P0-002-B are independent execution tracks; both are valid implementations of the approved dual-profile design.

---

## 9. Acceptance Criteria (P0-002-B)

When execution is authorized on a PC/server host, the following MUST be evidence-backed:

- [ ] AC-1: PostgreSQL 16 running in Docker (or native fallback); `pg_isready` returns 0
- [ ] AC-2: `psql` connection with development DATABASE_URL succeeds
- [ ] AC-3: `npx prisma migrate deploy` (or `migrate dev`) creates all 11 tables
- [ ] AC-4: `npx prisma generate` produces client without errors
- [ ] AC-5: `npx prisma validate` returns "schema is valid"
- [ ] AC-6: CRUD via Prisma Client succeeds for at least: SystemConfig, Order, Fill, Position, RiskDecision
- [ ] AC-7: ORDER → FILL (0..N) relationship enforced (multiple fills per order allowed; no 1:1 imposed)
- [ ] AC-8: Foreign key rejection: invalid `fill.orderId` throws; error captured
- [ ] AC-9: UNIQUE constraint: duplicate `clientOrderId` rejected; error captured
- [ ] AC-10: Transaction COMMIT: writes survive after `$transaction` returns
- [ ] AC-11: Transaction ROLLBACK: throw inside `$transaction` removes all intermediate writes
- [ ] AC-12: Persistence across process: write data, terminate Node, reconnect, data still present
- [ ] AC-13: Restart recovery: `docker compose restart postgres` does not lose data; FK integrity intact
- [ ] AC-14: No-dummy / security gate: no mock Prisma Client, no synthetic orders, no synthetic fills, no hardcoded credentials, no commits containing secrets
- [ ] AC-15: Canonical schema `prisma/schema.prisma` UNCHANGED; Profile A artifacts (`prisma/schema-sqlite.prisma`, `prisma/prisma.config.ts`, `test_real_prisma.mjs`) untouched
- [ ] AC-16: Trader Brain DISABLED, Live Trading DISABLED, Autonomous Trading DISABLED
- [ ] AC-17: Git status reviewed; no commit pushed during P0-002-B validation

---

## 10. Remaining Blockers (Pre-Execution)

- **No PC/server environment currently accessible** — this session is on Android/Termux/PRoot (Profile A target). P0-002-B validation requires transfer of the project to a Docker-capable host.
- **No credentials provisioned** — `.env` not created on PC. Production credentials must be set on the target host before `docker compose up`.
- **No CI runner with Docker** — local execution only; no shared CI environment authorized yet.

---

## 11. Out of Scope (Explicit)

- Live trading — DISABLED.
- Trader Brain — DISABLED.
- Autonomous trading loop — DISABLED.
- P0-003 (exchange abstraction) — NOT STARTED.
- Modifying canonical `prisma/schema.prisma` — FORBIDDEN in this task.
- Modifying `server/`, `src/`, `.env` — FORBIDDEN.
- Docker daemon interaction on this Android host — NOT ATTEMPTED (Profile B requires PC/server).

---

## 12. Files Inventory

### New (this task)
- `docs/audit/42-p0-002-b-postgresql-pc-server-plan.md` (this file)

### Untouched (verified)
- `prisma/schema.prisma` (canonical PG schema) — UNCHANGED
- `prisma/schema-sqlite.prisma` (Profile A artifact) — UNCHANGED
- `prisma/prisma.config.ts` (Profile A config) — UNCHANGED
- `server/`, `src/`, `.env` — UNCHANGED
- `package.json` (no dependency upgrade)
- `data/vua_p0_002_a.db` (Profile A artifact) — UNCHANGED
- `docs/audit/41-p0-002-a-final-acceptance.md` (Profile A closure) — UNCHANGED

### Documentation audit (4 files reviewed, 1 minimal update)
- `docs/audit/22-architecture-decisions.md` — reviewed; no correction required (no false SQLite-blocked claim present)
- `docs/audit/24-engineering-dependency-order.md` — reviewed; no correction required
- `docs/audit/27-vua-master-project-map.md` — already updated (P0-002-A PASS / P0-002-B BLOCKED-ENV split)
- `docs/audit/29-adr-002-database-review.md` — reviewed; existing design language consistent with P0-002-B plan

---

## 13. Next Task After P0-002-B Authorization

When a PC/server environment is provisioned and credentials are set, execute in order:

1. `git status` (verify clean baseline)
2. `docker compose up -d postgres` (start Profile B runtime)
3. `psql ...` (verify connection)
4. `npx prisma migrate dev` (apply canonical schema)
5. `npx prisma generate` (regenerate Prisma Client)
6. Run validation sequence §6 step-by-step
7. Capture evidence per AC-1..AC-17
8. Update `docs/audit/43-p0-002-b-postgresql-implementation.md` (post-execution)
9. No commit; defer to human review

Until a PC environment is available, P0-002-B remains **PLANNED**.

---

## 14. STOP

P0-002-B is PLANNED. NOT YET VALIDATED. WAIT FOR PC ENVIRONMENT.
