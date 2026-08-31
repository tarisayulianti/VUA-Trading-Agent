# ADR-002 — CORRECTION & IMPLEMENTATION-READINESS REVIEW

**Status:** PENDING HUMAN DECISION — not approved. Documentation-only.
**Depends on:** ADR-001 APPROVED (Hybrid TS + Optional Python).
**Implementation:** FORBIDDEN. No DB, no migrations, no Prisma, no source change.
**Purpose:** Technical corrections to the previous ADR-002 design before it can become an implementation contract.

---

## CORRECTION 1 — SOURCE OF TRUTH (RECONCILIATION HIERARCHY)

Not "DB wins." Define each state separately:

| State Type | Source of Truth | Notes |
|---|---|---|
| **DESIRED (user / AI)** | AI proposal (`DECISIONS`) — advisory only | No execution authority |
| **SUBMITTED (DB)** | DB authoritative; VUA `client_order_id` generated | Idempotency key |
| **OBSERVED (exchange)** | Exchange authoritative for fills / position counts | Exchange is external execution authority |
| **PERSISTED (DB)** | DB authoritative for history, audit, reconciliation events | Append-only events |
| **RECONCILED (operational)** | Derived from DB + exchange; discrepancy event always written | Never silently corrected |

When DB ≠ Exchange: reconciliation event (`reconciliation_events`) recorded, DB corrected ONLY after event written, operator alerted. Historical audit events never rewritten.

---

## CORRECTION 2 — ORDER LIFECYCLE STATE MACHINE

States (explicit): CREATED → RISK_APPROVED → SUBMITTING → SUBMITTED → ACKNOWLEDGED → PARTIALLY_FILLED → FILLED → CLOSED. Additional: CANCEL_REQUESTED → CANCELLED. Error: REJECTED, UNKNOWN, RECONCILING, FAILED.

Safe retry rules:
- Retry ALLOWED: same `client_order_id`, same order; DB checks event + exchange query.
- Retry FORBIDDEN: when DB has `fill_events` confirming execution; when status = FILLED; when `RECONCILING` — must resolve discrepancy first.
- Timeout: DB retains SUBMITTED; retry with same ID (exchange idempotency); never generate new `client_order_id`.

---

## CORRECTION 3 — ORDER ↔ POSITION RELATIONSHIP (CORRECTED)

Not `orders.id → positions.order_id` one-to-one.

Relationship model:
- **ORDER** (1) → **FILL** (0..N) → **POSITION** (current state updated per fill)
- One position can accumulate from multiple fills of the same order (partial fills) OR multiple orders (scaling in); `positions` tracks current aggregate quantity, entry price computed from weighted fills.
- FILL events (`fill_events.event_sequence`) determine history; `positions` is current-state only; `position_events` (append-only) records updates (open, price change, SL/TP, close).

---

## CORRECTION 4 — MARKET DATA RECOVERY

WebSocket disconnect does NOT replay DB tick. DB tick is historical / analysis only; real-time tick is ephemeral (Redis/memory). Recovery:

WebSocket disconnect → REST snapshot (current ticker/orderbook) → state resynchronization (DB open positions rebuilt) → reconnect WebSocket → continuity validation (compare last tick timestamp).

DB candles (`market_data_candles`) used for analysis/backtest — NOT for real-time recovery.

---

## CORRECTION 5 — POSITION RECONCILIATION

When DB position ≠ Exchange:
- Detect: reconciliation job compares DB `positions` + DB `fill_events` vs exchange position endpoint.
- Classify: `POSITION_MISMATCH` (quantity/price), `ORDER_MISMATCH` (submitted but missing), `FILL_MISMATCH` (fill exists only on one side), `PRICE_ANOMALY`.
- Reconcile: write `reconciliation_events` (immutable); apply DB correction ONLY after event; alert.
- Audit: event never deleted; historical `position_events` preserved.

---

## CORRECTION 6 — SCHEMA COMPLETENESS

Previous 11 entities reviewed. No unnecessary additions. Essential relationships confirmed: `ORDERS → FILL_EVENTS → POSITIONS → POSITION_EVENTS` (separate, not forced 1:1). `DECISIONS → RISK_DECISIONS` (audit, append-only). `CONFIG_HISTORY` (audit). `RECONCILIATION_EVENTS` (audit). `SYSTEM_EVENTS` (audit). `MARKET_DATA_CANDLES` (historical, not live tick).

---

## CORRECTION 7 — SECRET MANAGEMENT

Not production Vault only. Development: local `.env` with testnet keys only (no live API keys). Testnet: `production` use testnet-only DB/user. Production: Vault abstraction; DB stores reference/hash only — never plaintext `apiKey`/`secret` in `ORDERS`/`ACCOUNTS`. Development does NOT depend on Vault (local env file sufficient).

---

## CORRECTION 8 — RETENTION (REVIEWED — NOT IMMUTABLE)

Retention is POLICY, not immutable technical requirement. Revised classification:

- **HOT**: `system_config`, `orders` (open/submitted), `positions` (open), `reconciliation_events` (current year) — DB, short TTL archive.
- **WARM**: `fill_events`, `position_events`, `orders` (closed), `decisions`, `risk_decisions`, `system_events` — 1 year DB + archive.
- **COLD**: `market_data_candles` (historical) — 6+ months DB; then archive/Parquet.
- **EPHEMERAL**: real-time ticker, order book — Redis (optional); not DB.

Regulatory/audit retention: not specified; assume 7 years for audit (`system_events`, `reconciliation_events`). Not enforced as DB-level constraint.

---

## CORRECTION 9 — STORAGE RESPONSIBILITY MATRIX

| Data | PostgreSQL | In-Memory (Cache) | Redis (optional/future) | Exchange | Object Storage / Parquet (optional) |
|---|---|---|---|---|---|
| Risk config / decision audit | Yes (DB authoritative) | Cache | — | — | — |
| Order / Fill / Position state | Yes | Cache (current view) | — | Fills authoritative | — |
| Audit events (all append-only) | Yes | — | — | — | Archive > 2yr |
| Market data (historical candles) | Yes (HOT / WARM) | — | — | Source | Archive (COLD) |
| Real-time ticker / order book | — | Yes | Optional | Source | — |
| AI debates / proposals | Yes (audit) | Cache | — | — | — |
| Backtest results | Yes (WARM) | Cache | — | — | Archive |
| System health / error events | Yes | — | — | — | — |
| Exchange secrets | Reference only | — (Vault retrieval at runtime) | — | External | — |

---

## CORRECTION 10 — TRANSACTION BOUNDARIES

Atomic DB transactions (only DB; never include exchange call inside DB transaction):

- Risk decision (`DECISIONS` + `RISK_DECISIONS`): atomic — veto/approval must persist together.
- Order creation + event (`ORDERS` + `order_events` insert): atomic.
- Fill event (`fill_events` + `orders` status/quantity update + `positions` update): atomic per fill record.
- Position close (`position_events` + `orders` filled + `fill_events`): atomic.
- Reconciliation event (`reconciliation_events` + DB correction): event first, correction second — both within transaction.

NOT atomic (separate): DB transaction + exchange REST/WebSocket call. Exchange call is external; DB records result AFTER confirmation. No distributed transaction.

---

## CORRECTION 11 — CRASH CONSISTENCY

Permutations and recovery:

| DB commit | Exchange op | Process | Recovery |
|---|---|---|---|
| Success | Not yet called | Crash before call | Restart; DB shows SUBMITTED; retry with same `client_order_id` (idempotency) |
| Success | Submitted (ack) | Crash after ack, before DB event | Restart; query exchange; insert `order_events` from exchange; reconcile |
| Success | Filled (fill) | Crash after fill, before DB event | Restart; query exchange; insert `fill_events`; rebuild position |
| Not committed | Submitted (ack) | Crash before DB commit | Restart; DB has no record; query exchange; if order exists: insert DB + event |
| Not committed | Not submitted | Crash | Restart; no action needed (DB consistent) |
| Committed (event) | Submitted (but exchange reports failure) | Normal state | DB event preserved; reconciliation detects failure; order updated to REJECTED |

No overwritten events. No deleted audit records.

---

## CORRECTION 12 — IMPLEMENTATION READINESS CHECKLIST

| Criterion | Status | Evidence / Note |
|---|---|---|
| Source of truth hierarchy defined | Ready | Section "Source of Truth" — 5 types defined |
| Lifecycle states defined | Ready | 12+ states; retry rules defined |
| Schema relationships (not forced 1:1) | Ready | ORDER → FILL (0..N) → POSITION (aggregate) |
| Event model (append-only) | Ready | 11 event types; sequence numbering |
| Idempotency (client_order_id + DB constraint) | Ready | `UNIQUE(client_order_id, exchange, symbol)` |
| Reconciliation (discrepancy event + correction) | Ready | `reconciliation_events` — never silent |
| Recovery (10 scenarios) | Ready | All permutations covered |
| Transaction boundaries (DB-only atomic) | Ready | Never include exchange inside DB tx |
| Security (secret reference; no plaintext DB) | Ready | Vault reference; local env for dev |
| Retention (policy, not immutable) | Ready | HOT / WARM / COLD / EPHEMERAL |
| Migration strategy (phased) | Ready | Phase 1 → 6; reversible |
| Testing strategy | **Ambiguous** — requires definition of acceptance tests before implementation |

**ADR-002 Implementation Ready: NO** — one ambiguity: acceptance/testing strategy must be defined (unit/integration/reconciliation tests) before TASK-P0-002 can start. All other criteria resolved.

---

## FINAL STATUS — ADR-002

- **Status:** PENDING HUMAN DECISION (unchanged; NOT approved by agent).
- **Previous file (`29-adr-002-database-review.md`):** Not overwritten; remains as design document; corrected by this document (`30-adr-002-correction-review.md`).
- **Corrections applied:** 12 correction sections (source of truth, lifecycle, order/position relationship, market data recovery, reconciliation, schema, secrets, retention, storage matrix, transactions, crash consistency, readiness checklist).
- **Ambiguity remaining:** Testing/acceptance strategy definition.
- **Implementation forbidden:** Confirmed — no DB, no Prisma, no migrations, no `package.json` change, no `executionEngine.ts`/`memoryLedger.ts` change, no `server/routes/api.ts` DB integration.
- **Principle documented:** "AI may propose. Deterministic Risk Governor (TypeScript `riskEngine`) decides. PostgreSQL is persistence — not execution authority. Python optional only."

---

## FILES UPDATED / CREATED

- Created: `docs/audit/30-adr-002-correction-review.md` (this file)
- Referenced (not modified): `docs/audit/29-adr-002-database-review.md`
- Referenced (not modified): `docs/audit/22-architecture-decisions.md`, `27-vua-master-project-map.md`, `00-audit-summary.md`
- Source files: ZERO modifications.
- Database instances: ZERO created.
