# Prisma Integration Contract — P0-002 Runtime Integration Boundary

**Status:** DESIGN CONTRACT — NOT IMPLEMENTED
**Date:** 2026-09-01
**Role:** Principal Engineer ONLY
**Trader Brain:** DISABLED
**Live Trading:** DISABLED

---

## 1. AUTHORITY MODEL (ADR-002 PRESERVED)

| State Type | Authority | Persistence | Reconciliation Behavior |
|------------|-----------|-------------|-------------------------|
| DESIRED | AI advisory only | `decisions` table | No execution authority |
| SUBMITTED | DB authoritative | `orders` + `order_events` | Query exchange by `client_order_id` if missing after crash |
| OBSERVED | Exchange authoritative | `fill_events` appended from exchange | Exchange wins on fill conflict; DB corrected via reconciliation event |
| PERSISTED | DB authoritative | Append-only event tables | Never overwritten; discrepancies produce NEW event |
| RECONCILED | Derived from DB + Exchange | `positions` + `reconciliation_events` | Event first, correction after, operator alert |

---

## 2. PRISMA CLIENT OWNERSHIP

- One `PrismaClient` singleton is the sole access path to PostgreSQL from TypeScript backend services
- No raw SQL queries from application code unless explicitly documented and approved
- Prisma Client must be instantiated once at application startup from `prisma.config.postgres.ts`
- `prisma/schema.prisma` remains the source of truth for models, relations, and constraints
- Profile A SQLite and Profile B PostgreSQL are separate deployment targets; application MUST NOT switch providers dynamically

---

## 3. PERSISTENCE RESPONSIBILITIES BY MODULE

### 3.1 `api.ts`
Responsibilities:
- Read `system_config` for runtime flags: `engine_running`, `auto_trading_enabled`, `kill_switch_engaged`, `selected_exchange`, `selected_symbol`
- Replace module-level in-memory state with DB-backed reads where ADR-002 designates DB authority
- Persist `system_events` for lifecycle events: engine start/stop, kill switch engage/disengage, circuit breaker trip, data quality errors, exchange disconnect
- Do NOT store ephemeral SSE client lists in DB
- Do NOT store transient market ticks in DB

### 3.2 `executionEngine.ts`
Responsibilities:
- Persist `orders` on trade submission
- Persist `fill_events` when fills are observed from exchange
- Update `positions` aggregate state after fill reconciliation
- Persist `position_events` for every meaningful position transition
- Persist `closed_trades` equivalent via `position_events` and order status updates
- Do NOT create orders without DB authority; `client_order_id` MUST be generated before exchange submission
- Do NOT bypass risk engine; persistence must occur after risk approval

### 3.3 `riskEngine.ts`
Responsibilities:
- Persist every `evaluateTradeRisk()` call result to `risk_decisions`
- Include full context: symbol, exchange, checks passed/failed, veto reason, equity, drawdown, timestamp, engine mode
- Load risk configuration from `system_config` on startup; do not rely on in-memory defaults alone
- Log config changes to `config_history` via admin/API path
- Risk veto log is append-only; no update/delete permitted

### 3.4 `memoryLedger.ts`
Responsibilities:
- Replace seeded synthetic equity history with DB-reconstructed equity from `fill_events`, `position_events`, and `orders`
- Maintain in-memory cache only; DB is authoritative for historical equity
- Persist daily equity milestones to `system_events` or dedicated ledger table if approved

---

## 4. TRANSACTION BOUNDARIES

Atomic DB transactions only:
- `decisions` + `risk_decisions` insert
- `orders` + `order_events` insert
- `fill_events` + `orders` status/quantity update + `positions` update
- `position_events` + `orders` filled + `fill_events`
- `reconciliation_events` + DB correction

NOT atomic:
- DB transaction + exchange REST/WebSocket call
- Exchange call is external; DB records result AFTER confirmation

---

## 5. IDEMPOTENCY REQUIREMENTS

- Every logical order MUST carry a VUA-generated `client_order_id`
- `orders` table has `UNIQUE(client_order_id, exchange, symbol)`
- Retry/submit paths MUST reuse same `client_order_id`
- Adapter MUST query exchange before retry to prevent duplicate submission
- DB insert on duplicate `client_order_id` MUST fail with constraint violation; caught and handled as idempotency path

---

## 6. PROHIBITED PATTERNS

### 6.1 Prohibited In-Memory Authority Patterns
- `api.ts` module-level variables as sole source of truth for `engine_running`, `auto_trading_enabled`, `kill_switch_engaged`, `selected_exchange`, `selected_symbol`
- `executionEngine.ts` in-memory arrays as authoritative order/position state
- `riskEngine.ts` in-memory config as sole risk boundary source
- `memoryLedger.ts` seeded synthetic history as equity history

### 6.2 Prohibited Fake / SQLite Fallback
- No SQLite substitution for PostgreSQL in Profile B runtime
- No `pg-mem`, `pg-mock`, or mock Prisma Client in production/runtime paths
- No synthetic DB responses to mask connection failures
- No silent fallback from PostgreSQL to in-memory on DB errors

### 6.3 Prohibited Migration/Change Patterns
- No automatic migration execution at application startup
- No manual schema changes outside Prisma Migrate
- No `prisma db push` unless explicitly authorized for isolated validation
- No destructive migration without backup/restore verification

---

## 7. MIGRATION / CHANGE-CONTROL RULES

- All schema changes via Prisma Migrate only
- Review every migration before production deployment
- Backup PostgreSQL before production migration; verify restore within 1 hour
- Production uses `prisma migrate deploy`; development may use `prisma migrate dev`
- Migration files committed to repo; never run unreviewed migration against production
- No two migrations targeting same table concurrently
- Down migration required for every development migration; production down migrations tested in staging first

---

## 8. SOURCE CHANGE RULES FOR P0-002 INTEGRATION

Only the following files may be modified during P0-002 integration:
- `prisma.config.postgres.ts` — connection/config only
- `server/services/*` — to inject Prisma Client and replace in-memory persistence
- `server.ts` or startup path — to instantiate PrismaClient
- `docs/audit/*` — handoff/evidence documentation

The following are frozen unless explicitly re-authorized:
- `prisma/schema.prisma` — canonical schema
- `prisma/migrations/` — committed migrations
- `docker-compose.yml` — database service definition
- `server/services/binance.ts`, `server/services/bybit.ts` — exchange clients
- `server/services/executionEngine.ts`, `server/services/riskEngine.ts` — core logic boundaries
- `.env.example` — template only

---

## 9. NEXT GATE

After this contract is approved:
1. Execute runtime handoff sequence in `41-p0-002-runtime-handoff.md`
2. Collect evidence using `43-gate-evidence-template.md`
3. Produce P0-002 PASS/FAIL evidence package before integration begins

STOP.
WAIT FOR NEXT INSTRUCTION.
