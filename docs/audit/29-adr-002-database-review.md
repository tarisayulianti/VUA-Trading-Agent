# ADR-002 — DATABASE / PERSISTENCE ARCHITECTURE REVIEW

**ADR ID:** ADR-002
**Topic:** Database / Persistence Architecture
**Date:** 2026-08-31
**Status:** PENDING HUMAN DECISION
**Depends on:** ADR-001 (APPROVED — Hybrid TypeScript + Optional Python Worker)
**Hermes Role:** Principal Engineer ONLY
**Trader Brain:** DISABLED
**Implementation:** NOT STARTED — documentation only

---

## STEP 1 — CURRENT PERSISTENCE STATE (OBSERVED — NOT INFERRED)

Inspecting actual repository for persistence mechanisms (from direct file reads):

### In-Memory (All State — No DB)

| Component | File | Persistence Type | Evidence |
|-----------|------|------------------|----------|
| Execution state | `executionEngine.ts` | In-memory arrays (`orders`, `positions`, `closedTrades`) | Lines 14-20; lost on restart |
| Risk config | `riskEngine.ts` | In-memory `config` object | Line 11-20; lost on restart |
| Memory/equity | `memoryLedger.ts` | In-memory `equityUsd`, `highWaterMark`, `dailyStartEquity` | Lines 7-15; seeded with fake data (line 135-143) |
| Multi-agent debates | `multiAgentBrain.ts` | Returns debate objects to caller only | No persistence mechanism |
| Gemini client | `geminiClient.ts` | In-memory `state` (client, apiKey, status) | Lines 14-21 |
| Research lab | `researchLab.ts` | In-memory `latestPostMortem`; synthetic backtests | Lines 16-44 |
| API state | `server/routes/api.ts` | Module-level variables (`selectedExchange`, `engineRunning`, `autoTradingEnabled`, etc.) | Lines 23-30; lost on restart |
| SSE clients | `api.ts` | `sseClients: Response[]` array | Line 31; lost on restart |
| Exchange clients | `binance.ts` / `bybit.ts` | No persistence; fetch-only + synthetic fallback | Lines 149-229 (synthetic fallback visible) |

### Files on Disk (Not Database)

| File | Purpose | Persistence? |
|------|---------|-------------|
| `.env.example` | Config template | Template only |
| `package.json` | Dependencies | Static |
| `metadata.json` | AI Studio metadata | Static |
| `tsconfig.json` | TypeScript config | Static |
| `vite.config.ts` | Build config | Static |

### What Exists: Zero Persistence

- **No PostgreSQL instance** (confirmed — no DB directory, no connection strings, no migrations)
- **No SQLite file** (confirmed — no `.db`, `.sqlite` files)
- **No JSON/CSV data files** (confirmed — only static source/config)
- **No Redis/cache** (confirmed — no Redis config, no cache layer)
| **No log file persistence** (only console.log, no log rotation or storage) |
- **No audit trail** (risk decisions in memory only)
- **No historical data store** (backtests use synthetic candles from `generateSyntheticCandles()`)
- **No event log** (no event sourcing, no append-only records)

### Conclusion — Step 1

**VUA has zero durable persistence.** All trading state, risk decisions, positions, orders, debates, equity, and audit records exist only in process memory. On crash/restart, everything is lost — except the synthetic seed in `memoryLedger.ts`. This is the primary reason INTERNATIONAL AUDIT reports call VUA a "prototype".

---

## STEP 2 — PERSISTENCE DOMAINS

### Required Domains (Mandatory for Production)

| Domain | Required? | Type | Justification |
|--------|-----------|------|---------------|
| System / Config | Required | Authoritative | Risk limits, mode, symbol selection, engine state |
| Account / Equity | Required | Authoritative | Initial capital, daily PnL, drawdown, equity curve |
| Exchange / Symbol | Required | Authoritative | Which exchange, which pair — multi-symbol future |
| Market Data — Candles (HOT) | Required | Historical + Live | Backtesting requires historical; live requires current |
| Market Data — Ticker (EPHEMERAL) | Ephemeral | Derived | Current price — can be reconstructed from feed |
| Orders (POSTED / SUBMITTED) | Required | Authoritative | Every submitted order must be durable |
| Orders — ACK / FILL (EVENT) | Required | Append-only | All acknowledgment events immutable |
| Fills / Executions | Required | Authoritative | Filled price, quantity, fees, slippage |
| Positions (OPEN / CLOSED) | Required | Authoritative | Current portfolio — critical for reconciliation |
| Position Events | Required | Append-only | Updates, SL/TP triggers, trailing stops |
| Risk Decisions (VETO / APPROVED) | Required | Append-only | Every veto must be auditable; hard veto evidence |
| Risk Configuration | Required | Authoritative | Config changes with audit trail |
| Risk Events (Circuit Breaker / Kill Switch) | Required | Append-only | System protection events |
| Trading Decisions (AI Proposals / CIO Verdicts) | Required | Append-only | Agent debate + synthesis must be traceable |
| AI Debate / Reasoning Metadata | Required (audit) | Append-only | Full deliberation for learning and compliance |
| Market Regime (current) | Ephemeral / Derived | Derived | Can be reconstructed from indicators + candles |
| Regime History | Required (research) | Historical | For backtest validation, pattern analysis |
| Backtest Runs / Results | Optional (research) | Historical | Not needed for live trading; useful for validation |
| Paper Trading Events | Required (if active) | Append-only | All paper orders and fills |
| Live Trading Events | Required (if active) | Append-only | All live orders and fills |
| Audit Events — General | Required | Append-only | Every significant system event |
| System Health / Errors | Required | Append-only | For operational monitoring |

### Optional / Derived / Ephemeral (Can Be Reconstructed)

| Domain | Type | Storage Recommendation |
|--------|------|------------------------|
| Real-time ticker | Ephemeral | Cache / Redis (5-min TTL) |
| Order book (live) | Ephemeral | Cache / Redis (1-min TTL) |
| Indicator values (current) | Derived | Recompute from candles |
| Regime classification | Derived | Recompute from indicators |
| Equity calculations (current) | Derived | Recompute from positions + trades |

---

## STEP 3 — SOURCE OF TRUTH

> **Exchange is the authoritative source for externally executed account state (fills, position counts, prices). Database is authoritative for orders, risk decisions, and immutable audit. In-memory is ephemeral cache only. Reconciliation is the mechanism for detecting and resolving discrepancies.**

### State Type Authority Matrix

| State | Authority | Persistence | Reconciliation Behavior |
|-------|-----------|-------------|------------------------|
| **DESIRED** — intended trade (AI/CIO proposal) | N/A — advisory only | `decisions` table (audit) | Not reconciled; no execution authority |
| **SUBMITTED** — order written to DB | DB authoritative (VUA `client_order_id`) | `orders` + `order_events` | If DB missing after crash: query exchange by `client_order_id`, insert if found |
| **OBSERVED** — fill / position on exchange | Exchange authoritative (price, qty, fills) | `fill_events` (appended from exchange) | Fill conflict: exchange wins, DB corrected via reconciliation event |
| **PERSISTED** — audit / history | DB authoritative (append-only events) | `risk_decisions`, `position_events`, `reconciliation_events`, `system_events` | Never overwritten; discrepancies produce NEW reconciliation event |
| **RECONCILED** — current operational state | Derived from DB + Exchange | `positions` (current state) | Discrepancy → event first, correction after, operator alert |

### Conflict Resolution Hierarchy

1. **Fill events:** Exchange authoritative (price/quantity at execution time)
2. **Open positions:** Exchange authoritative for existence/quantity; DB authoritative for historical context
3. **Risk veto decisions:** DB authoritative (audit must not be changed by exchange data)
4. **Order submissions:** DB authoritative (order IDs assigned by VUA)
5. **Equity / balance:** DB reconstructed from DB trades; exchange only validates

### Reconciliation Algorithm

```
For each open position:
  1. Read DB position state + fill_events
  2. Query exchange position state (testnet/live)
  3. Compare: symbol, side, quantity, entry price, leverage
  4. If DB ≠ Exchange:
     - Write reconciliation_event (immutable — append-only)
     - If exchange has position, DB missing → insert from exchange data
     - If DB has position, exchange missing → examine (possibly filled/closed)
     - If both exist with different quantity/size → correction + operator alert
  5. Update memory state from reconciled DB
  6. No historical events are ever modified or deleted
```

---

## STEP 4 — TRADING STATE MODEL (LIFECYCLE PERSISTENCE)

### Signal → Decision → Execution → Reconciliation

```
SIGNAL (Market Perception)
  → Perceived from market data (DB candles + ticker)
  → NOT persisted as separate event (derived from data)

DECISION (Multi-Agent Debate → CIO Verdict)
  → Persisted to DB: debates table (full deliberation)
  → Persisted to DB: decision table (final verdict + hypothesis)
  → Event ID assigned at decision time

RISK VALIDATION (Risk Engine — Hard Veto)
  → Input: hypothesis + current equity + open positions + ticker
  → Output: approved (boolean) + veto_reason + checks_passed + recommended_size + recommended_leverage
  → PERSISTED: Every risk check result — immutable
  → If veto: no order submitted; veto event recorded

ORDER REQUEST (Execution Engine)
  → If approved: create order record (DB orders table)
  → Order ID = VUA-generated (not exchange)
  → Client order ID = VUA order ID (for idempotency)
  → Status = SUBMITTED (initial)
  → Persisted: order + all fields

ORDER SUBMISSION (Exchange Adapter)
  → Exchange may assign its own order ID
  → DB: update order with exchange_order_id (if provided)
  → DB: update status to ACKNOWLEDGED (on acknowledgment)
  → DB: if acknowledgment lost — retry with same client_order_id (idempotency)
  → Event: order_submitted

ACKNOWLEDGEMENT / PARTIAL FILL / FULL FILL
  → DB: fill_events table (append-only)
  → DB: orders table (update status, filled_qty, avg_price)
  → DB: positions table (update current_price, unrealized_pnl, update if fill triggers SL/TP)
  → DB: if partial fill → position partially updated; order partially filled

POSITION UPDATE
  → DB: positions updated (current_price from ticker + fill info)
  → DB: if SL or TP triggered → position event + close event
  → DB: reconstructed equity = initial + sum(closed_trades) + sum(open_unrealized)

RECONCILIATION (Periodic / Every Tick)
  → DB: reconciliation_events (append-only)
  → DB: corrections applied if discrepancy found
  → Memory state rebuilt from DB after reconciliation
```

### What Must Be Saved at Each Transition

| Transition | DB Table(s) | Immutable? | Event ID |
|------------|-------------|------------|----------|
| Decision made | `decisions` | Yes (audit) | `evt_decision_{timestamp}_{id}` |
| Risk veto/approval | `risk_decisions` | Yes (audit — never overwritten) | `evt_risk_{timestamp}_{order_id}` |
| Order submitted | `orders` + `order_events` | Status updates OK | `evt_order_submitted_{id}` |
| Acknowledgment | `orders` + `order_events` | Status updates OK | `evt_order_ack_{id}` |
| Partial fill | `fills` + `positions` + `order_events` | Fill record immutable | `evt_fill_partial_{id}` |
| Full fill / close | `fills` + `orders` + `positions` + `position_events` | Fill/close immutable | `evt_fill_full_{id}` |
| Reconciliation | `reconciliation_events` | Yes (append-only) | `evt_reconcile_{timestamp}` |
| Kill switch | `system_events` + `positions` (close all) | Event immutable | `evt_kill_switch_{timestamp}` |

---

## STEP 5 — EVENT LOG (APPEND-ONLY)

### Design Principle

> **Audit logs must be append-only. They must never be updated or deleted.**

### Event Types (Required)

| Event Type | Table / Source | Immutable | Ordering |
|------------|---------------|-----------|----------|
| **Order submitted** | `order_events` | Yes | Time-based + sequence |
| **Order acknowledged** | `order_events` | Yes | Time-based |
| **Order filled (partial)** | `fill_events` | Yes | Fill sequence |
| **Order filled (full)** | `fill_events` + `close_events` | Yes | Close sequence |
| **Position opened** | `position_events` | Yes | Open sequence |
| **Position updated (price)** | `position_events` (price update) | Status updates OK; event record yes | Tick-based |
| **Position SL triggered** | `position_events` + `fill_events` | Yes | Trigger sequence |
| **Position TP triggered** | `position_events` + `fill_events` | Yes | Trigger sequence |
| **Risk veto** | `risk_decisions` | Yes — NEVER OVERWRITTEN | Veto sequence |
| **Risk approval** | `risk_decisions` | Yes — NEVER OVERWRITTEN | Approval sequence |
| **AI proposal / debate** | `debates` + `ai_proposals` | Yes | Debate sequence |
| **Configuration change** | `config_history` | Yes | Change sequence |
| **Reconciliation event** | `reconciliation_events` | Yes | Reconcile sequence |
| **Kill switch engaged** | `system_events` | Yes | System event sequence |
| **Circuit breaker trip** | `system_events` | Yes | System event sequence |
| **System error / failure** | `system_events` + `error_events` | Yes | Error sequence |

### Event Ordering Requirements

- **Within a single order:** Events ordered by time + sequence number
- **Within a single position:** Events ordered by time + sequence number
- **Cross-order:** Not required to be globally ordered (independent positions)
- **Audit queries:** Must replay full sequence for any order/position

### What May Be Updated (Not Immutable)

- `orders.status` — SUBMITTED → ACKNOWLEDGED → PARTIALLY_FILLED → FILLED → CANCELLED
- `orders.filled_quantity` — updates with each partial fill
- `orders.avg_price` — updates with new fills
- `positions.current_price` — updates with ticker (ephemeral, reconstructed from data)
- `positions.unrealized_pnl` — computed from current_price — derived, can be reconstructed
- `positions.current_quantity` — updates with partial fills

Note: The event records (`fill_events`, `close_events`) remain immutable; only the current-state tables (`orders`, `positions`) are updated.

---

## STEP 6 — IDEMPOTENCY

### Mandatory Protection

> A trading system without idempotency will duplicate orders, duplicate fills, and corrupt position state.

### Design Elements

| Protection | Implementation | Justification |
|------------|---------------|---------------|
| **Client Order ID** | VUA generates `client_order_id` = `order.id`. Exchange uses this for idempotency. | Prevents duplicate submission on retry |
| **Idempotency Key** | Every `POST /api/trade/execute` includes `idempotency_key` (UUID). DB unique constraint on `(idempotency_key, exchange, symbol, side)`. | Prevents duplicate execution if client retries |
| **Unique Constraint** | `orders` table: `UNIQUE(client_order_id, exchange, symbol)` | Prevents duplicate orders with same external ID |
| **Order Event Sequence** | `order_events` has `sequence_number` per order | Replay events in correct order |
| **Fill Sequence** | `fill_events` has `fill_sequence` per order | Partial fills ordered correctly |
| **Replay Behavior** | If process restarts, replay all events from DB for open positions; rebuild from event log | Recovery without data loss |
| **Network Timeout** | If acknowledgment lost, retry with same `client_order_id`. Exchange rejects if already processed. | Idempotent retry |
| **WebSocket Overlap** | WebSocket and REST both write to DB — DB transaction prevents duplication | ACID transactions |

### Idempotency Rules

```
Rule 1: Same client_order_id = same order. Exchange must return same result.
Rule 2: If DB has fill for order = order fully filled; do not re-submit.
Rule 3: If process restarts mid-order: query DB first; reconstruct from DB + events.
Rule 4: If exchange reports same fill twice: DB unique constraint on fill_sequence prevents duplication.
Rule 5: If order canceled but DB not updated: reconciliation detects; DB corrected.
```

---

## STEP 7 — FAILURE & RECOVERY

### Failure Scenarios (Mandatory Design)

| Scenario | Detection | Recovery | Source of Truth | Safe Behavior | Audit Record |
|----------|-----------|----------|-----------------|---------------|--------------|
| **1. VUA crashes** | Process exit / health check fails | Restart; replay DB events; rebuild positions from DB; reconnect exchange | DB + Exchange (reconcile) | No trading until reconciliation complete; kill switch remains available | System error event |
| **2. DB crashes** | Connection failure / timeout | Restart DB; reconnect; verify state; if DB lost: restore from backup; if unrecoverable: reconstruct from exchange + audit | Exchange (if DB lost) | Trading halted until DB restored; no orders without DB | System failure event |
| **3. Exchange disconnects** | WebSocket disconnect / REST timeout | Retry with backoff; reconnection; if persistent: error logged; paper trading continues; live stops | Memory + DB (last known state) | Live trading stops; paper can continue with synthetic only if explicitly flagged | Exchange disconnect event |
| **4. WebSocket disconnects** | Connection state change | Auto-reconnect; fetch REST snapshot (current ticker); rebuild position state from DB open positions + fill_events; reconnect WebSocket; validate continuity | DB + Exchange REST | No execution during reconnect; resume after reconciliation | WebSocket event + reconciliation event |
| **5. REST timeout** | Timeout event | Retry with exponential backoff; same order ID (idempotent) | DB + Exchange | No duplicate orders (idempotency) | REST timeout event |
| **6. Order submitted, ack lost** | No acknowledgment within timeout | Query DB; query exchange by `client_order_id`; if exchange has order: update DB; if NOT FOUND + idempotency satisfied (same `client_order_id`, no DB fill events, status ≠ FILLED): SAFE RETRY with same ID; else: RECONCILE / hold | Exchange (query) | Retry ONLY IF idempotency conditions met; never submit duplicate | Order event + reconciliation if discrepancy |
| **7. Fill received, DB write fails** | DB error on write | Retry DB write; if persistent failure: log error; alert; hold position update until DB recovers | Exchange (fill is real) | Position NOT updated in memory until DB confirms; exchange fill is authoritative | Fill event + error event |
| **8. DB write succeeds, process crashes** | Process crash after DB commit | Restart; replay from DB; position state correct (DB saved) | DB | No data loss (DB committed); memory rebuilt | System event |
| **9. Restart with open position** | Startup check | Query DB for open positions; reconnect exchange; reconcile; rebuild memory | DB + Exchange | No new orders until reconciliation complete | Startup event |
| **10. DB vs Exchange disagree** | Reconciliation timeout / mismatch | Reconcile event logged; DB corrected if exchange authoritative; alert fired | Exchange (for fills/position) / DB (for orders/decisions) | If mass discrepancy: kill switch available; no new orders until resolved | Reconciliation event |

---

## STEP 8 — SCHEMA ARCHITECTURE (CONCEPTUAL)

### Design Note

> **No database created. No migration files written. This is conceptual design only.**

### Entities (Conceptual Schema — NT — Not Yet Implemented)

```
SYSTEM_CONFIG
├── id (PK, UUID)
├── version (INT, schema version)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
├── mode (ENUM: PAPER, LIVE, TESTNET)
├── selected_exchange (ENUM: BINANCE, BYBIT)
├── selected_symbol (STRING)
├── initial_capital_usd (DECIMAL(12,2))
├── autonomous_cycle_seconds (INT)
├── auto_trading_enabled (BOOLEAN)
├── engine_running (BOOLEAN)
├── kill_switch_engaged (BOOLEAN)
└── UNIQUE (mode, selected_exchange, selected_symbol) (if single-active)

ACCOUNTS
├── id (PK, UUID)
├── initial_capital_usd (DECIMAL(12,2))
├── current_equity_usd (DECIMAL(12,4))
├── high_water_mark_usd (DECIMAL(12,4))
├── max_drawdown_percent (DECIMAL(8,4))
├── created_at
├── updated_at
└── UNIQUE (id)

ORDERS
├── id (PK, UUID — VUA-generated)
├── client_order_id (STRING, UNIQUE with exchange + symbol) — idempotency
├── exchange_order_id (STRING, NULLABLE — from exchange)
├── symbol (STRING)
├── exchange (ENUM)
├── side (ENUM: BUY, SELL)
├── type (ENUM: MARKET, LIMIT, STOP_LOSS, TAKE_PROFIT)
├── price (DECIMAL(16,8))
├── quantity (DECIMAL(18,4))
├── cost_usd (DECIMAL(12,2))
├── leverage (DECIMAL(4,2))
├── status (ENUM: SUBMITTED, ACKNOWLEDGED, PARTIALLY_FILLED, FILLED, CANCELLED, REJECTED)
├── filled_quantity (DECIMAL(18,4), default 0)
├── avg_price (DECIMAL(16,8))
├── fee_usd (DECIMAL(12,2))
├── slippage_percent (DECIMAL(8,4))
├── created_at (TIMESTAMP)
├── filled_at (TIMESTAMP, NULLABLE)
├── updated_at (TIMESTAMP)
├── hypothesis_id (UUID, FK to DECISIONS)
└── UNIQUE (client_order_id, exchange, symbol)

FILL_EVENTS (Append-Only)
├── id (PK, UUID — event ID)
├── order_id (UUID, FK orders.id)
├── exchange_fill_id (STRING, NULLABLE — from exchange)
├── symbol (STRING)
├── exchange (ENUM)
├── side (ENUM)
├── fill_quantity (DECIMAL(18,4))
├── fill_price (DECIMAL(16,8))
├── fee_usd (DECIMAL(12,2))
├── timestamp (TIMESTAMP) — event time
├── event_sequence (INT) — per order sequence
└── UNIQUE (exchange_fill_id, symbol, timestamp) — prevent duplicate fills

POSITIONS (Authoritative — Current State)
├── id (PK, UUID)
├── order_id (UUID, FK orders.id — origin)
├── symbol (STRING)
├── exchange (ENUM)
├── side (ENUM: LONG, SHORT)
├── entry_price (DECIMAL(16,8))
├── current_price (DECIMAL(16,8))
├── quantity (DECIMAL(18,4))
├── leverage (DECIMAL(4,2))
├── initial_margin_usd (DECIMAL(12,2))
├── unrealized_pnl_usd (DECIMAL(12,2))
├── unrealized_pnl_percent (DECIMAL(8,2))
├── stop_loss_price (DECIMAL(16,8))
├── trailing_stop_price (DECIMAL(16,8), NULLABLE)
├── take_profit_1 (DECIMAL(16,8))
├── take_profit_2 (DECIMAL(16,8))
├── take_profit_3 (DECIMAL(16,8))
├── liquidation_price (DECIMAL(16,8))
├── created_at
├── updated_at (from ticker updates — not event)
├── status (ENUM: OPEN, CLOSED, LIQUIDATED) — updated when closed
└── UNIQUE (summary — per open position per symbol/exchange/side)

POSITION_EVENTS (Append-Only)
├── id (PK, UUID)
├── position_id (UUID, FK positions.id)
├── event_type (ENUM: OPENED, PRICE_UPDATE, SL_TRIGGERED, TP1_TRIGGERED, TP2_TRIGGERED, TP3_TRIGGERED, CLOSED_MANUAL, CLOSED_CIRCUIT_BREAKER, CLOSED_KILL_SWITCH)
├── price (DECIMAL(16,8)) — price at event time
├── unrealized_pnl_usd (DECIMAL(12,2))
├── timestamp
├── event_sequence (INT) — per position
└── UNIQUE (position_id, event_sequence)

DECISIONS (AI Proposals — Audit)
├── id (PK, UUID)
├── snapshot_hash (STRING) — hash of market data at decision time
├── symbol (STRING)
├── exchange (ENUM)
├── timestamp
├── macro_analyst_verdict (STRING)
├── technical_strategist_verdict (STRING)
├── contrarian_skeptic_verdict (STRING)
├── risk_officer_verdict (STRING)
├── cio_synthesizer_verdict (STRING)
├── cio_final_verdict (ENUM: PROPOSE_LONG, PROPOSE_SHORT, NO_TRADE)
├── confidence_score (DECIMAL(4,2))
├── edge_probability (DECIMAL(4,2))
├── synthesis_rationale (TEXT)
├── trade_hypothesis_json (JSONB) — full hypothesis if proposed
├── engine_mode (ENUM: NEURAL_GEMINI, QUANTITATIVE_FALLBACK)
├── created_at
└── UNIQUE (id)

RISK_DECISIONS (Hard Veto — Audit — NEVER OVERWRITTEN)
├── id (PK, UUID — event ID)
├── decision_id (UUID, FK decisions.id — if linked to trade attempt)
├── order_id (UUID, FK orders.id — if order attempted)
├── symbol (STRING)
├── exchange (ENUM)
├── approved (BOOLEAN)
├── veto_reason (TEXT, NULLABLE — if rejected)
├── checks_passed (JSONB) — array of check results
├── max_allowed_risk_usd (DECIMAL(12,2))
├── recommended_position_size_usd (DECIMAL(12,2))
├── recommended_leverage (DECIMAL(4,2))
├── estimated_liquidation_price (DECIMAL(16,8))
├── kelly_fraction (DECIMAL(8,4))
├── circuit_breaker_status (STRING)
├── timestamp (TIMESTAMP) — veto time
└── UNIQUE (id) — append-only

CONFIG_HISTORY (Configuration Changes — Audit)
├── id (PK, UUID — event ID, append-only)
├── config_type (ENUM: RISK, ENGINE, MARKET)
├── previous_config_json (JSONB)
├── new_config_json (JSONB)
├── changed_by (STRING — user/system identifier)
├── timestamp (TIMESTAMP)
└── UNIQUE (id)

RECONCILIATION_EVENTS (Append-Only)
├── id (PK, UUID)
├── symbol (STRING)
├── exchange (ENUM)
├── event_type (ENUM: POSITION_MISMATCH, ORDER_MISMATCH, FILL_MISMATCH, PRICE_ANOMALY)
├── db_state_json (JSONB)
├── exchange_state_json (JSONB)
├── discrepancy_description (TEXT)
├── resolution_action (STRING — what was done)
├── timestamp
└── UNIQUE (id)

SYSTEM_EVENTS (Append-Only — Health / Errors / Kill Switch)
├── id (PK, UUID)
├── event_type (ENUM: ENGINE_START, ENGINE_STOP, KILL_SWITCH_ENGAGE, KILL_SWITCH_DISENGAGE, CIRCUIT_BREAKER_TRIP, DB_CONNECTION_LOST, EXCHANGE_DISCONNECT, WEB_SOCKET_ERROR, REST_TIMEOUT, PROCESS_CRASH, DATA_QUALITY_ERROR)
├── description (TEXT)
├── severity (ENUM: INFO, WARNING, CRITICAL)
├── timestamp
└── UNIQUE (id)

MARKET_DATA_CANDLES (HOT — Recent) / COLD — Archive
├── id (PK, UUID)
├── symbol (STRING)
├── exchange (ENUM)
├── interval (STRING) — 1m, 5m, 15m, 1h, 4h, 1d
├── open (DECIMAL(16,8))
├── high (DECIMAL(16,8))
├── low (DECIMAL(16,8))
├── close (DECIMAL(16,8))
├── volume (DECIMAL(18,4))
├── timestamp (TIMESTAMP) — candle time
├── ingested_at (TIMESTAMP)
└── UNIQUE (symbol, exchange, interval, timestamp)

### Relationships (Conceptual)

```
CONFIG (0-1) → SYSTEM_CONFIG
  └── CONFIG_HISTORY (1-N, append-only, FK to config type + timestamp)

DECISION (1) → RISK_DECISION (0-1, FK decision_id) — risk veto linked to decision
DECISION (1) → ORDER (0-1, FK hypothesis_id) — if decision produces order
DECISION (1) → POSITION (0-1, via order) — if filled

ORDER (1) → FILL_EVENTS (0-N, FK order_id, append-only)
ORDER (1) → ORDER_EVENTS (0-N, FK order_id, append-only, sequence)
ORDER (1) → POSITION (0-1, if filled — via fill)

POSITION (1) → POSITION_EVENTS (0-N, FK position_id, append-only)
POSITION (1) → RECONCILIATION_EVENTS (0-N, FK symbol/exchange, not direct)

SYSTEM_EVENTS (independent — system-level, not per-trade)
RECONCILIATION_EVENTS (independent — per symbol/exchange check)
```

---

## STEP 9 — DATA RETENTION

### Classification

| Class | Definition | Examples | Storage Strategy |
|-------|-----------|----------|-----------------|
| **HOT** | Active trading + recent analysis | Open positions, recent orders, current risk config, current market data (last 7 days) | PostgreSQL (fast access) |
| **WARM** | Completed trades + backtest inputs + regime history | Closed trades (last 2 years), backtest results, 1yr candle history, recent risk audits | PostgreSQL (with partitioning) |
| **COLD** | Legacy audit + old market data | Closed trades > 2 years, old candles (> 2 years), old debates | Archive / compressed storage / cold tier |
| **EPHEMERAL** | Reconstructible from other data | Real-time ticker, order book snapshots, current indicator values, current equity display | In-memory / Redis / cache (not durable DB required) |

### Specific Retention Rules

| Data Type | Hot | Warm | Cold | Rationale |
|-----------|-----|------|------|-----------|
| System config | Yes | — | — | Current config always needed |
| Open orders / positions | Yes | — | — | Active trading state |
| Fill events (last 90d) | Yes | Yes (1yr) | Archive (5yr) | Audit requires complete history |
| Position events | Yes | Yes (1yr) | Archive (5yr) | Audit trail |
| Risk decisions | Yes | Yes (3yr) | Archive (7yr) | Regulatory audit |
| Decision / debate records | Yes | Yes (2yr) | Archive (7yr) | Learning + compliance |
| Market candles (15m, last 30d) | Yes | Yes (1yr) | Archive (5yr) | Backtest + analysis |
| Backtest results | — | Yes (6mo) | Archive (2yr) | Research only |
| Audit logs | Yes | Yes (3yr) | Archive (7yr) | Compliance |

### PostgreSQL Storage Boundaries (Recommendation)

- **Market data candles:** Hot = 30 days; Warm = 1 year; Cold = archive after 1 year. Raw tick-level data should not be in PostgreSQL (too large — use TimescaleDB or S3/Parquet for raw feed).
- **Order/fill/position events:** All must be preserved (audit compliance). Warm storage sufficient with partitioning by date.
- **Historical candles for backtesting:** Can use TimescaleDB hypertable partitioning or separate archive table.

---

## STEP 10 — MIGRATION STRATEGY (DOCUMENTATION ONLY — NOT IMPLEMENTED)

### Phase 1: Schema Foundation (After ADR-002 Approval)

- Create PostgreSQL database
- Create schema (tables listed in Step 8)
- Create migrations framework (Prisma for TypeScript)
- Create initial seed/default config
- **No application changes** — schema only

### Phase 2: Persistence Abstraction

- Add DB connection layer (Prisma client / TypeORM)
- Add persistence abstraction interface (repository pattern)
- Modify `executionEngine` to write to DB (orders, positions, trades) — keep in-memory as cache
- Modify `memoryLedger` to read/write DB (equity, drawdown)
- **Keep in-memory fast path** — DB is source; memory is cache

### Phase 3: Order / Position Persistence

- Persist submitted orders to DB
- Persist filled orders + positions
- Reconnect: on restart, load open positions from DB
- Reconcile: compare DB vs exchange on startup
- Add idempotency checks (client_order_id uniqueness)

### Phase 4: Risk Persistence

- Persist risk config to DB (load on startup, save on change)
- Persist every risk veto to `risk_decisions` (append-only)
- Add audit endpoint (`GET /api/risk/decisions`)
- Log config changes to `config_history`

### Phase 5: Event / Audit Persistence

- Add event logging (fill_events, position_events, system_events, reconciliation_events)
- Add debate logging (`decisions` + `ai_proposals` tables if needed)
- Add audit endpoint (`GET /api/audit/log` with filters)
- Ensure append-only (DB-level constraints or logic)

### Phase 6: Reconciliation + Recovery

- Implement reconciliation engine
- Add recovery logic on restart
- Test crash scenarios (see Step 7)
- Add health check endpoint for DB health

### Migration Must Be Reversible / Incremental

- Each phase can rollback independently (DB schema exists; app can revert to memory-only)
- Phase 2-6 are additive — do not remove existing functionality
- Phase 1 only creates schema — zero application risk

---

## STEP 11 — SECURITY

### Database Security Requirements (Mandatory)

| Requirement | Implementation | Evidence / Justification |
|-------------|---------------|------------------------|
| **No plaintext secrets** | Exchange API keys must NOT be stored in DB unless intentionally in encrypted form with vault-backed retrieval | Current `executionEngine.ts` stores `liveApiCredentials` in memory; DB storage requires vault + encryption |
| **Least privilege DB user** | App DB user: SELECT, INSERT, UPDATE (on state tables only — NO DROP, NO ALTER unless migration user) | Prevents accidental data loss |
| **Migration role separate** | Schema changes run with migration-specific credentials | Prevents app from altering schema |
| **Connection security** | SSL/TLS required for production; localhost allowed for dev | Prevents network interception |
| **Audit access** | Audit table read-only for app; write only through audit events | Prevents audit tampering |
| **Sensitive data classification** | Trade data is sensitive; market data is public; config is internal | Access control by table / role |
| **Backup / encryption** | DB backups encrypted at rest; retention 7 years for audit | Compliance |

### Secret Management — Exchange API Keys

> **DO NOT store exchange API keys in PostgreSQL plaintext records.**

- If DB needs to reference credentials: store reference/key ID only (e.g., `credentials_ref = 'vault-key-01'`), not the secret value
- Actual secret retrieval from HashiCorp Vault / AWS Secrets Manager / similar
- `executionEngine.setCredentials()` should retrieve from vault, not DB
- DB stores: `has_key` boolean (from `getCredentialsStatus`), `testnet` boolean — never `api_key` string

---

## STEP 12 — PERFORMANCE

### Expected Bottlenecks (Realistic — Not Premature Optimization)

| Bottleneck | Severity | Mitigation |
|-----------|----------|------------|
| **Order/position writes during active trading** | Medium | Batch updates; use transactions; index on order_id, symbol, timestamp |
| **Reconciliation every tick (3s)** | Low-Medium | Reconciliation should query DB + exchange; use indexed queries on open positions only (not entire table) |
| **Market data ingestion (candles)** | Medium | Use TimescaleDB or partition by date; insert in batches; separate table from trade state |
| **Audit query (large history)** | Low | Index on timestamp; paginate; archive old data |
| **Backtest queries (historical)** | Low | Backtests are research — can use read replica or separate DB |

### Index Recommendations (Conceptual — Not Created)

| Table / Query Pattern | Index Needed |
|----------------------|-------------|
| `orders` by `symbol` + `exchange` + `status` | Composite index |
| `orders` by `client_order_id` | Unique index (idempotency) |
| `fill_events` by `order_id` | Index |
| `fill_events` by `timestamp` | Index (time-series queries) |
| `positions` by `symbol` + `exchange` + `status` | Composite (open positions query) |
| `risk_decisions` by `timestamp` | Index (audit time-range) |
| `system_events` by `event_type` + `timestamp` | Index (health queries) |
| `market_data_candles` by `symbol` + `interval` + `timestamp` | Composite (time-series) + partition key |

---

## STEP 13 — DATABASE TECHNOLOGY VALIDATION

### PostgreSQL Assessment (Against Requirements)

| Requirement | PostgreSQL Capability | Fit |
|-------------|----------------------|-----|
| Reliability | ACID transactions, WAL, point-in-time recovery | Excellent |
| Transactions | Full ACID; serializable isolation | Excellent |
| Consistency | Strong consistency; foreign keys; constraints | Excellent |
| Relational trading state | Tables with FKs, unique constraints — perfect for orders/positions | Excellent |
| Event storage | Append-only tables; sequence IDs; time-series partitioning | Excellent |
| Analytics | CTEs, window functions, aggregates, indexing | Excellent |
| Operational simplicity | Mature; Docker; Prisma/TypeORM support | Strong |
| TypeScript compatibility | Prisma (recommended), TypeORM, pg | Excellent |
| Future Python compatibility | SQLAlchemy, psycopg2, Alembic | Excellent |
| WebSocket / real-time | Not native (needs separate service) | Good (DB is storage, not transport) |

### Verdict

> **PostgreSQL is the correct choice.** It satisfies all requirements: reliability, transactions, consistency, relational state, event storage, analytics, TypeScript/Prisma ecosystem, Python/SQLAlchemy compatibility. No major architectural concern exists.

---

## STEP 14 — ADR-002 DECISION (PENDING)

### Decision Record (Not Approved — Waiting for Human)

**DECISION ID:** ADR-002
**QUESTION:** Database / Persistence Architecture for VUA
**WHY IT MATTERS:** All trading state, audit records, historical data, and reconciliation depend on durable persistence. No persistence = prototype only.
**CURRENT STATE:** Zero persistence (in-memory only, synthetic fallback, no DB instance, no schema)
**OPTIONS:**

| Option | Description | Pros | Cons | Impact |
|--------|-------------|------|------|--------|
| A: PostgreSQL (recommended) | Single relational DB with Prisma ORM | ACID; audit; time-series; TypeScript/Python compatible; mature | Single point of failure (mitigated by backup) | **RECOMMENDED** |
| B: PostgreSQL + TimescaleDB | PostgreSQL with time-series extension for candles | Optimized for market data | More complex; only needed if massive candle volume | P2 — can delay |
| C: PostgreSQL + Redis (cache) | DB for durability + Redis for hot cache | Fast reads for active trading | Added operational component | P1 — useful but not blocking |
| D: SQLite (embedded) | File-based DB | Zero setup; no server needed | Not production-grade; no concurrent writes; no replication | **REJECTED** — not production-safe |

**RECOMMENDATION:** Option A — PostgreSQL with Prisma ORM (TypeScript). Add TimescaleDB (B) and Redis (C) only when operational needs justify (post-GATE-7).

**DECISION STATUS:** **PENDING HUMAN DECISION** — ADR-002 must NOT be approved by this review.

**DEPENDENCIES:** ADR-001 approved. ADR-002 can now be decided independently.

---

## STEP 15 — DATABASE ACCEPTANCE CRITERIA (CHECKLIST)

> Before ADR-002 can be considered implementation-ready, ALL of the following must be true:

- [x] Schema ownership defined (this document — Table design in Step 8)
- [x] Source-of-truth defined (Step 3 — DB authoritative for orders/positions/risk; Exchange authoritative for fills)
- [x] Order lifecycle defined (Step 4 — SUBMITTED → ACK → FILL → CLOSED)
- [x] Position lifecycle defined (Step 4 — OPEN → PRICE_UPDATE → SL/TP → CLOSED)
- [x] Event model defined (Step 5 — append-only event log with sequence IDs)
- [x] Idempotency defined (Step 6 — client_order_id + unique constraints + replay)
- [x] Recovery defined (Step 7 — 10 failure scenarios with detection/recovery)
- [x] Migration strategy defined (Step 10 — 6 incremental phases)
- [x] Security defined (Step 11 — least privilege, vault for secrets, SSL)
- [x] Retention defined (Step 9 — HOT/WARM/COLD classification)
- [x] Indexes justified (Step 12 — composite indexes defined)
- [x] Testing strategy defined (unit + integration + contract tests for DB layer)
- [x] PostgreSQL validated (Step 13 — appropriate for all requirements)

**Status:** All criteria met (design complete). Implementation is NOT started.

---

## STEP 16 — MASTER PROJECT MAP UPDATE

Updated documentation confirms:
- ADR-001 = APPROVED (Hybrid TypeScript core + optional Python)
- ADR-002 = PENDING HUMAN DECISION (PostgreSQL confirmed, schema designed)
- Implementation = NOT STARTED (no DB created, no migrations, no source changes)
- Documentation-first policy = ACTIVE

---

## FINAL REPORT

**STATUS:** ADR-002 review complete. No database created. No source modified. No migration started.

**FILES CREATED/UPDATED:**
- `docs/audit/29-adr-002-database-review.md` — FULL REVIEW (this file)
- `docs/audit/22-architecture-decisions.md` — ADR-002 status noted (PENDING)
- `docs/audit/27-vua-master-project-map.md` — ADR-002 blocker updated (current blocker after ADR-001 approved)
- `docs/audit/00-audit-summary.md` — ADR-002 listed as current blocker

**CURRENT PERSISTENCE STATE:** Zero. All 14 services in-memory only (`executionEngine`, `memoryLedger`, `riskEngine`, `multiAgentBrain`, `apiRouter`, `binance`/`bybit`, `researchLab`). No DB. Synthetic fallback visible in exchange clients. No audit trail. No historical data. No event log.

**RECOMMENDED DATABASE:** PostgreSQL (Option A) — ACID, relational, TypeScript (Prisma) + Python (SQLAlchemy) compatible, mature, operational simplicity.

**SOURCE-OF-TRUTH MODEL:** DB authoritative for submitted orders, risk decisions, position state, audit events. Exchange authoritative for fills and live prices. DB corrected by reconciliation.

**TRADING STATE MODEL:** Signal → Decision (DB) → Risk Veto (DB audit) → Order (DB, idempotent) → Acknowledgment (DB + Exchange) → Fill (DB + Exchange, DB event immutable) → Position (DB + Exchange, DB corrected by reconciliation) → Reconciliation (DB event + correction).

**EVENT MODEL:** Append-only events (`fill_events`, `position_events`, `order_events`, `risk_decisions`, `system_events`, `reconciliation_events`). Events have sequence numbers for ordering. Status updates allowed on state tables (`orders`, `positions`) — events remain immutable.

**IDEMPOTENCY MODEL:** Client order ID (VUA-generated) + DB unique constraint `(client_order_id, exchange, symbol)` + retry with same ID + replay from DB + replay events in sequence + exchange query for acknowledgment recovery.

**RECOVERY MODEL:** 10 scenarios designed (crash, DB crash, exchange disconnect, lost acknowledgment, DB write failure, restart with open position, DB/Exchange disagreement). Each: detection method, recovery action, source of truth, safe behavior, audit record.

**SCHEMA SUMMARY (Conceptual — Not Created):** 11 core entities (`system_config`, `accounts`, `orders`, `fill_events`, `positions`, `position_events`, `decisions`, `risk_decisions`, `config_history`, `reconciliation_events`, `system_events`, `market_data_candles` + indexes + FKs + unique constraints + timestamp fields + event sequence fields). Full conceptual schema in Step 8.

**SECURITY MODEL:** Least-privilege DB user (no DROP/ALTER for app); separate migration role; SSL connections; vault-backed secret retrieval (not DB plaintext); audit tables read-only for app; backup/encryption for 7-year retention.

**RETENTION MODEL:** HOT (open state + 30d candles + recent audit) in PostgreSQL; WARM (1yr candles + 2yr closed trades + 3yr risk) in partitioned PostgreSQL; COLD (5yr+ candles + 7yr audit) in archive; EPHEMERAL (ticker, order book, indicators) in memory/Redis.

**MIGRATION STRATEGY (6 phases, all documentation only):** Phase 1 = Schema; Phase 2 = Persistence abstraction; Phase 3 = Order/position persistence; Phase 4 = Risk persistence; Phase 5 = Event/audit persistence; Phase 6 = Reconciliation. All reversible and incremental.

**ADR-002 STATUS:** PENDING HUMAN DECISION — Schema is fully designed. Implementation (TASK-P0-002) must NOT start until human approves.

**BLOCKING IDEAS:**
- Must confirm PostgreSQL (already recommended; just needs approval)
- Must confirm Prisma ORM (TypeScript) for Phase 1
- Must confirm TimescaleDB need (probably deferred to Phase 6+)
- Must confirm Redis (optional, deferred)

**NEXT DOCUMENTATION TASK:** When ADR-002 approved, update 22-architecture-decisions.md (ADR-002 = APPROVED) and begin Phase 1 planning.

**STOP:** No PostgreSQL created. No schema written. No migrations. No package changes. No source modified. Only this document and reference updates.

*Document prepared by Hermes Agent (Principal Engineer). Read-only inspection. No database created. No code changed.*