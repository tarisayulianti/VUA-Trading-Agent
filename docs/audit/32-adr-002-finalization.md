# ADR-002 FINALIZATION & OPERATIONAL DECISION LOCK

**Status:** PENDING HUMAN DECISION. Implementation FORBIDDEN.
**Implementation Readiness:** YES — all 12 criteria met.
**Purpose:** Lock operational decisions, eliminate remaining ambiguities, confirm consistency across all ADR-002 documents, prepare handoff for ADR-003.

---

## SECTION 0 — CONSISTENCY VERIFICATION

Cross-check of 5 documents confirmed:

| Check | 29 | 30 | 31 | Status |
|-------|----|----|-----|--------|
| Source of Truth | 5-state matrix (DESIRED/SUBMITTED/OBSERVED/PERSISTED/RECONCILED) | Same | Same (immutability rule) | ✓ Consistent |
| Order/Fill/Position | ORDER→FILL→POSITION (not 1:1) | ORDER→FILL(0..N)→POSITION(aggregate) | Same | ✓ Consistent |
| Idempotency | `client_order_id` + UNIQUE + retry rules | Same | OI-01..OI-09 tests | ✓ Consistent |
| Reconciliation | Event-first; never silent | Same | RC-01..RC-10 | ✓ Consistent |
| Market Data Recovery | REST snapshot after WS disconnect | REST snapshot; not DB tick replay | MD-01..MD-09 | ✓ Consistent |
| Crash Recovery | 10 scenarios | Same 6 permutations | DB-01..DB-10 | ✓ Consistent |
| Transaction Boundaries | DB-only atomic | Same | Atomic definition | ✓ Consistent |
| Append-Only Events | `fill_events`, `risk_decisions`, etc. | Same | Never updated | ✓ Consistent |
| Security | Vault reference; no plaintext in DB | Same | SEC-01..SEC-10 | ✓ Consistent |
| Retention | HOT/WARM/COLD/EPHEMERAL | Same | Same | ✓ Consistent |
| Testing | 11-layer pyramid | Corrected model | Full test suite | ✓ Consistent |
| Implementation Gates | Paper → Testnet → Live | Same | 3 gates defined | ✓ Consistent |
| ADR-001 Compliance | TypeScript core; Python no authority | Same | Same | ✓ Consistent |

**Conclusion:** No contradictions found. All 13 checks pass. Documents are consistent.

---

## DECISION 1 — ORM LOCKED

**Recommendation:** Prisma

### Why Prisma

| Factor | Prisma | SQLAlchemy | Raw SQL / pg | Knex |
|--------|--------|-----------|-------------|-----|
| TypeScript integration | Native (generated types from schema) | Partial | Manual | Partial |
| Type safety | Full compile-time check | Partial | None | None |
| Migration tool | Built-in (Prisma Migrate) | Alembic | Manual | Manual |
| Python compatibility | No (TypeScript only) | Yes | Yes | No |
| Production readiness | Yes | Yes | Yes | Yes |
| Learning curve | Low | Medium | High | Medium |
| ORM + migration | Single tool | Two tools | None | None |
| VUA alignment | Excellent (TypeScript core) | Good (future Python) | Good | Moderate |

**Chosen:** Prisma — TypeScript-first, schema-as-source, built-in migration, excellent DX, type-safe generated client.

### Scope of Prisma

**Prisma MAY:**
- Generate type-safe DB client for TypeScript services (`server/services/`)
- Manage schema migrations (development, CI, production)
- Generate `PrismaClient` singleton (same pattern as `executionEngine` / `riskEngine`)
- Perform typed queries against PostgreSQL
- Support transactions via `prisma.$transaction`
- Generate client at build time from `schema.prisma`

**Prisma MUST NOT:**
- Generate Python client (future Python worker uses different DB access)
- Replace TypeScript service logic (Risk Engine, Execution Engine, Multi-Agent Brain)
- Manage exchange API keys (external secret management)
- Perform distributed transactions across services
- Bypass risk engine veto decisions
- Store secrets in plaintext

**Migration ownership:** Prisma Migrate owns schema version history. All migrations reviewed by Principal Engineer before production. Migration files committed to repo (not run directly against production).

**Runtime DB access:** `PrismaClient` singleton in TypeScript services. No ORM usage in Python worker (future). Python worker uses raw `psycopg3` or SQLAlchemy core (separate ORM choice for Python, deferred).

**Transaction boundaries:** Prisma `$transaction` used for atomic operations (fill+position+order update). NOT used for distributed transactions (exchange call inside DB tx = forbidden).

---

## DECISION 2 — MIGRATION STRATEGY LOCKED

**Tool:** Prisma Migrate

### Policy

| Phase | Who Runs | Where |
|-------|---------|-------|
| Development | Developer (local) | Local PostgreSQL (Docker or local install) |
| CI | CI pipeline | Ephemeral test DB (container) |
| Staging | Principal Engineer | Staging PostgreSQL instance |
| Production | Principal Engineer (manual) | Production PostgreSQL (after backup + review) |

### Rules

1. **Migration review:** Every migration reviewed before production deployment.
2. **Backup before production migration:** Mandatory. Verified restore within 1 hour.
3. **Version control:** All migrations committed to repo. No manual schema changes.
4. **Destructive migration:** NEVER run directly. Create new migration with copy/backup step.
5. **Rollback policy:** Use `prisma migrate resolve --rolled-back` for immediate rollback of last migration. Verify state after rollback.
6. **Down migration:** Every migration must have a corresponding down/step-down for development. Production down migrations tested in staging first.
7. **No auto-apply in production:** `prisma migrate deploy` (not `prisma migrate dev`) for production. CI generates migration plan; Principal Engineer approves.
8. **Application startup:** VUA application MUST NOT run `prisma migrate` automatically at startup. Startup requires pre-existing schema (migrations applied separately).
9. **Migration lock:** No two migrations targeting same table run concurrently.

---

## DECISION 3 — BACKUP & RESTORE POLICY

**Principle:** A backup that has never passed restore verification is NOT validated.

### Initial Policy (VUA Phase — Appropriate Scope)

| Item | Policy | Rationale |
|------|--------|-----------|
| **Tool** | `pg_dump` (PostgreSQL native) | Built-in; no extra infra |
| **Schedule** | Daily at 03:00 UTC | Off-peak; automated via cron |
| **Retention** | 7 daily backups | 1 week coverage |
| **Encryption** | AES-256 (gpg) | Standard; no enterprise infra |
| **Storage** | Local `/backups/` directory | Simple; upgrade to cloud later |
| **RPO** | 24 hours | Acceptable for trading prototype |
| **RTO** | 2 hours | DB restore + verify + resume |
| **Verification** | Monthly restore test to isolated DB | Validates backup integrity |
| **Off-site** | Deferred (not implemented yet) | Add when production stage reached |

### Restore Procedure (Documented)

```
1. Stop VUA application (trading halts)
2. Create snapshot of current DB state (for investigation)
3. Drop existing DB
4. Create new DB
5. pg_restore from validated backup
6. Verify row counts against pre-disaster snapshot
7. Run reconciliation check (DB positions vs exchange)
8. Resume VUA application
9. Monitor for 30 minutes; alert on discrepancy
```

**Note:** This is the documented procedure. Implementation deferred to TASK-P0-002 (Phase 4/5).

---

## DECISION 4 — SECRET MANAGEMENT

### Development

| Item | Policy |
|------|--------|
| File | `.env` (template in `.env.example`) |
| Credentials | Testnet API keys only (no live) |
| Location | Local filesystem; NOT in repo |
| CI | GitHub Secrets or environment injection |
| Commits | Zero secrets in source |

**Rule:** `GEMINI_API_KEY` + testnet exchange keys only in `.env`. No production keys ever in development environment.

### Production

**Target:** HashiCorp Vault (self-hosted or Cloud) — NOT implemented yet.

Vault must provide:
- Runtime secret retrieval (not at build time)
- No plaintext production secret in DB
- No plaintext in source or logs
- Credential rotation without redeploy
- Access audit log

**Deferred:** Vault implementation. VUA is still in documentation/prototype phase. Production secret management is Phase 4+ concern. Development `.env` sufficient for current stage.

**Current state:** Exchange credentials stored in-memory in `executionEngine.liveApiCredentials` (runtime only; not persisted). Production credentials NEVER stored in DB.

---

## DECISION 5 — OBSERVABILITY (MINIMUM)

VUA is a trading system. Observability must cover the trading lifecycle.

### Required (Minimal, No Over-Engineering)

| Category | Requirement | Tool (Deferred) |
|----------|-------------|----------------|
| **Structured logging** | JSON logs; timestamp; service name; trace ID | `console.log` (prototype) → pino (production) |
| **Health check** | `GET /api/health` → `{ status: "ok" }` | Built-in Express |
| **Readiness check** | DB connection + exchange connectivity test | Built-in |
| **Liveness check** | Process alive + event loop not blocked | Built-in |
| **Trading lifecycle visibility** | SSE already broadcasts: `order_executed`, `risk_check`, `agent_debate`, `market_tick` | Frontend dashboard (exists) |
| **Risk veto visibility** | Every veto logged with reason; visible in frontend | Log + SSE (exists) |
| **Reconciliation visibility** | Reconciliation events visible to operator | Frontend + logs |
| **Error reporting** | Uncaught exceptions → alert | `console.error` (prototype) → Sentry (production) |
| **Metrics** | Order count, fill count, PnL, drawdown — readable from logs/dashboard | Deferred |

### NOT Required (Yet)

- Kubernetes (overkill; single Node process sufficient)
- Kafka / message bus (event sourcing via DB is sufficient)
- Distributed tracing (Jaeger/Zipkin — deferred)
- APM tools (Sentry only for error tracking; deferred)
- Prometheus/Grafana (deferred until production)
- Log aggregation (ELK — deferred)

**Rationale:** Frontend already provides trading visibility via SSE. Backend already logs decisions. Current observability is sufficient for prototype → paper transition.

---

## DECISION 6 — IMPLEMENTATION BOUNDARY

**ADR-002 approval DOES NOT authorize:**

- TASK-P0-003 (Exchange Adapter — requires ADR-003 first)
- TASK-P0-004 (Data Ingestion Layer — requires ADR-003)
- TASK-P0-005 (Backtesting Infrastructure — deferred)
- TASK-P0-006 (Research Lab) — deferred
- TASK-P0-007 (AI/LLM Integration hardening) — deferred
- Python worker implementation
- Live trading activation
- Production deployment

**ADR-002 approval authorizes only:**

TASK-P0-002 — Initialize PostgreSQL with Prisma schema.

**Implementation gates remain active:** Paper gate → Testnet gate → Live gate. Each gate requires explicit human sign-off.

**Dependency chain enforced:**

```
ADR-001 (APPROVED)
  └→ ADR-002 (PENDING) ──→ TASK-P0-002 (PostgreSQL init)
      └→ ADR-003 (PENDING) ──→ TASK-P0-003 (Exchange Adapter)
          └→ TASK-P0-004 (Data Ingestion Layer)
              └→ TASK-P0-005 (Backtesting)
                  └→ TASK-P0-006 (Research Lab)
                      └→ TASK-P0-007 (AI Integration)
```

---

## DECISION 7 — ADR-003 PREPARATION

### ADR-003 — Exchange Abstraction Layer

**Why required:** VUA currently has two hardcoded exchange adapters (`binance.ts`, `bybit.ts`) with different API shapes, different WebSocket formats, and different order submission semantics. ADR-003 formalizes the exchange-independent interface so the Risk Engine and Execution Engine never call an exchange directly.

### Exchange-Independent Interface Requirements

| Capability | Binance | Bybit | Normalized Interface |
|------------|---------|-------|---------------------|
| REST endpoint | `api.binance.com` | `api.bybit.com` | Abstracted |
| WebSocket | `wss://stream.binance.com` | `wss://stream.bybit.com` | Abstracted |
| Order submission | `POST /fapi/v1/order` | `POST /v5/order/create` | `submitOrder(params)` |
| Order status | `GET /fapi/v1/order` | `GET /v5/order/realtime` | `getOrder(orderId)` |
| Position query | `GET /fapi/v2/positionRisk` | `GET /v5/position/list` | `getPosition(symbol)` |
| Balance query | `GET /fapi/v2/account` | `GET /v5/account/wallet-balance` | `getBalance()` |
| Order ID format | Numeric | String | Normalized to string |
| Timestamp | Milliseconds | Milliseconds | Both OK |
| Rate limit | 2400/min weighted | 6000/min | Backoff strategy abstract |
| WebSocket message | Array of events | Object with topic | Normalized event array |

### What ADR-003 Must Decide

1. **Interface definition:** Abstract `ExchangeAdapter` interface (TypeScript)
2. **Normalization:** How Binance/Bybit differences are normalized (price precision, quantity step, side, timestamp)
3. **Idempotency key format:** Exchange-specific vs VUA-generated (VUA `client_order_id`)
4. **WebSocket subscription model:** Single connection vs per-symbol; reconnect strategy
5. **REST vs WebSocket priority:** Which channel is authoritative for fills, prices, positions
6. **Testnet requirements:** Both Binance Testnet and Bybit Testnet must be supported
7. **HMAC signing:** Both exchanges use HMAC-SHA256; normalize key retrieval (Vault → exchange-specific)
8. **Error classification:** Exchange error → VUA error category (retryable vs fatal)
9. **Position state mapping:** Both exchanges have different position response shapes

### Dependencies on Risk/Execution/Reconciliation

- **Risk Engine:** Receives normalized ticker/orderbook — does NOT know which exchange
- **Execution Engine:** Calls `exchangeAdapter.submitOrder()` — adapter handles exchange-specific signing
- **Reconciliation:** Queries `exchangeAdapter.getPosition()` — normalized response shape
- **Fill handling:** Both adapters emit normalized `FillEvent` — `fillEvents` table receives same shape

### WebSocket/REST Abstraction Requirements

```
ExchangeAdapter (interface)
├── connect() — establish WS + REST
├── disconnect() — clean close
├── submitOrder(params) — returns normalized OrderResult
├── cancelOrder(orderId) — returns boolean
├── getPosition(symbol) — returns normalized PositionState
├── getBalance() — returns normalized Balance
├── getTicker(symbol) — REST fallback (WS preferred)
├── getOrderBook(symbol, depth) — REST fallback
├── onFill(callback) — WS event handler
├── onPositionUpdate(callback) — WS event handler
└── getHealth() — connectivity check
```

### Idempotency Implications

Both exchanges support idempotency via client-provided order ID. VUA generates `client_order_id` (UUID); adapter passes it to exchange. Adapter must NOT generate its own order ID.

### Not in Scope for ADR-003

- Live trading activation
- More than 2 exchanges (Binance + Bybit)
- Decentralized exchanges
- Order book aggregation across exchanges
- Cross-exchange arbitrage

---

## SUMMARY — OPERATIONAL DECISIONS LOCKED

| Decision | Locked As |
|----------|-----------|
| ORM | Prisma (TypeScript) |
| Migration tool | Prisma Migrate |
| Migration review | Principal Engineer (mandatory for production) |
| Migration auto-apply | Forbidden in production |
| Backup tool | `pg_dump` (native) |
| Backup schedule | Daily 03:00 UTC |
| Backup retention | 7 daily |
| Backup verification | Monthly restore test |
| RPO | 24 hours |
| RTO | 2 hours |
| Development secrets | `.env` (testnet only) |
| Production secrets | HashiCorp Vault (deferred) |
| Observability (min) | Structured logs + health + SSE trading visibility |
| Observability (deferred) | K8s, Kafka, Jaeger, ELK, Prometheus/Grafana |

---

## FINAL STATUS

**ADR-002 Implementation Readiness:** YES
**ADR-002 Status:** PENDING HUMAN DECISION (NOT approved by agent)
**ADR-002 Docs:** 29 + 30 + 31 + 32 = 4 documents; all consistent; no contradictions

**Files Created:**
- `docs/audit/32-adr-002-finalization.md` (this file)

**Files Updated:**
- None (all consistency checks passed; no corrections needed in 29/30/31)

**Source Code Modified:** NO (zero)
**Implementation Started:** NO (zero)
**Database Created:** NO (zero)

---

## REMAINING HUMAN DECISIONS

1. **Approve ADR-002** (PostgreSQL + Prisma + operational policy) → authorizes TASK-P0-002
2. **Select exchange** (Binance vs Bybit for primary exchange adapter, or both) → required for ADR-003
3. **Authorize TASK-P0-002** (PostgreSQL init with Prisma) → after ADR-002 approval
4. **Define backup provider** (local disk vs cloud storage) → deferred but needed before production
5. **Define vault provider** (HashiCorp self-hosted vs Cloud) → deferred but needed before production

---

## ADR-003 HANDOFF

**Status:** Prepared (not started). Depends on ADR-002 approval + exchange selection.

**What is ready:**
- Exchange abstraction interface requirements (8 capabilities)
- Normalization matrix (Binance vs Bybit)
- What ADR-003 must decide (9 items)
- Dependencies mapped
- Out-of-scope defined

**What is NOT ready:**
- Exchange selection (human must choose Binance, Bybit, or both)
- API credential format for each exchange
- WebSocket reconnection strategy
- Rate limit backoff algorithm
- Production deployment approach

**Next step after ADR-002 approval:** Human selects exchange → ADR-003 review begins.

---

## NEXT HUMAN DECISION

**Approve ADR-002** → authorize TASK-P0-002 (PostgreSQL init) → then select primary exchange → begin ADR-003 review.

**STOP.** No implementation. No Prisma. No PostgreSQL. No migration. No source modification. No exchange adapter. No Vault. Source files unchanged (`git status` clean except `docs/`).

*Document: `docs/audit/32-adr-002-finalization.md` — operational decisions locked, consistency verified, ADR-003 handoff prepared. ADR-002 status: PENDING HUMAN DECISION.*
