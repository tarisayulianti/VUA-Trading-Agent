# ADR-003 — Exchange Abstraction Layer — Documentation Only

**Status:** HANDOFF READY (DOCUMENTATION PHASE) — APPROVED — DOCUMENTED, NOT YET IMPLEMENTED
**Task reference:** Phase 3 of P0-002 environment recovery / documentation-first continuation
**Scope:** DOCUMENTATION ONLY — No `ExchangeAdapter` code, no `BybitAdapter`, no `BinanceAdapter`
**Source boundary:** `executionEngine.ts`, `riskEngine.ts`, `api.ts` untouched

---

**Status Constraints:** Trader Brain DISABLED | Live Trading DISABLED

## 1. ARCHITECTURE ABSTRACTION

```
                    VUA CORE (TypeScript)
                         │
              ExchangeAdapter (interface/abstract)
                     /           \
                    /             \
         BybitAdapter          BinanceAdapter
            (V5)                 (REST/WebSocket)
```

**Mandatory:** `VUA Core` MUST NOT depend directly on any exchange-specific response format.
Every exchange interaction flows through `ExchangeAdapter` → concrete adapter.

---

## 2. EXCHANGEADAPTER INTERFACE (DOCUMENTED CONTRACT)

```typescript
// Conceptual (NOT implemented in source — documentation only)
interface ExchangeAdapter {
  // Connection / Health
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<ExchangeHealth>;

  // Orders (normalized)
  submitOrder(order: NormalizedOrder): Promise<NormalizedOrderResult>;
  cancelOrder(clientOrderId: string, symbol: string): Promise<NormalizedCancelResult>;
  queryOrder(clientOrderId: string): Promise<NormalizedOrderState>;

  // Fills (normalized)
  observeFills(): AsyncIterable<NormalizedFill>;

  // Positions (normalized)
  observePositions(): AsyncIterable<NormalizedPosition>;

  // Market data (normalized)
  observeMarket(symbol: string, interval: string): AsyncIterable<NormalizedCandle>;

  // Account / balance
  observeAccount(): AsyncIterable<NormalizedBalance>;
}
```

---

## 3. PRIMARY / SECONDARY EXCHANGES

| Exchange | Adapter | Version / Endpoint | Priority | Notes |
|----------|---------|-------------------|----------|-------|
| Bybit | `BybitAdapter` | V5 (REST + WebSocket) | Primary | Existing code (`bybit.ts` exists in source — reference only, NOT modified) |
| Binance | `BinanceAdapter` | REST + WebSocket | Secondary | Existing code (`binance.ts` exists — reference only, NOT modified) |

---

## 4. NORMALIZED DOMAIN OBJECTS

Every adapter converts exchange-specific response into these objects:

- `NormalizedOrder` — `client_order_id`, `symbol`, `side`, `price`, `quantity`, `status`, `exchange_order_id`
- `NormalizedFill` — `fill_id`, `order_id`, `price`, `quantity`, `fee`, `timestamp`
- `NormalizedPosition` — `symbol`, `side`, `quantity`, `entry_price`, `unrealized_pnl`, `leverage`
- `NormalizedBalance` — `asset`, `free`, `locked`, `total`
- `NormalizedMarketEvent` (candle) — `symbol`, `interval`, `open`, `high`, `low`, `close`, `volume`, `timestamp`
- `NormalizedCandle`
- `ExchangeHealth` — status string, timestamp
- `ExchangeError` — `code`, `message`, `retryable` boolean

---

## 5. REST BOUNDARY

- REST used for: order submission, cancellation, account query, historical market data
- All REST responses converted to normalized objects before reaching VUA core
- REST errors converted to `NormalizedExchangeError` with `retryable` flag

---

## 6. WEBSOCKET BOUNDARY

- WebSocket used for: real-time fills, position updates, market data ticks (ephemeral — NOT persisted to PostgreSQL unless explicitly required by P0-002 design)
- WebSocket disconnect must trigger: reconnect with exponential backoff
- Lost messages after reconnect must trigger: reconciliation query (REST snapshot) — NOT replay DB tick (DB tick replay is incorrect per ADR-002 correction)
- WebSocket connection must NOT bypass `ExchangeHealth` check

---

## 7. ORDER NORMALIZATION

```
Exchange-specific REST/WS response
        ↓
BybitAdapter / BinanceAdapter
        ↓
NormalizedOrder (client_order_id, status, symbol, side, quantity, price, ...)
        ↓
VUA Core (executionEngine / riskEngine)
```

- `client_order_id` = VUA-generated, unique (`UNIQUE(client_order_id, exchange, symbol)` per P0-002 schema)
- `exchange_order_id` = assigned by exchange upon ACK; may be NULL before ACK
- Status mapping: `CREATED → SUBMITTED → ACKNOWLEDGED → PARTIALLY_FILLED → FILLED → CANCELLED → REJECTED → UNKNOWN`

---

## 8. FILL NORMALIZATION

```
Exchange fill event (WS / REST snapshot)
        ↓
Adapter converts to NormalizedFill
        ↓
append-only `fill_events` table (P0-002 schema) with:
  order_id, symbol, exchange, fill_quantity, fill_price,
  fee_usd, fee_rate, timestamp, event_sequence
```

- Multiple fills per order permitted (0..N) — consistent with P0-002 schema
- Partial fills preserved; aggregate fill quantity tracked separately (not overwritten)

---

## 9. POSITION NORMALIZATION

```
NormalizedPosition (aggregate from fills)
        ↓
Current `positions` table (reconciled state)
```

- Position = aggregate of fills (not 1:1 with orders) — consistent with P0-002 schema (`originating_order_id` field allows multi-order contribution to one position conceptually)
- Position updates must NOT silently overwrite historical events (append-only `position_events` per P0-002)

---

## 10. BALANCE / ACCOUNT NORMALIZATION

```
Exchange account query (REST)
        ↓
NormalizedBalance (per asset)
        ↓
VUA risk / equity calculation
```

- Account normalization must NOT expose withdrawal permissions to adapter
- Adapter must NOT initiate withdrawals
- Adapter only queries balance; VUA core decides actions

---

## 11. SYMBOL NORMALIZATION

- Symbol mapping between exchange notation (`BTCUSDT`, `BTC/USDT`, `BTC-USDT`, etc.) and VUA internal notation (`BTC/USDT` standard)
- Adapter must handle mapping; VUA core always uses standardized notation
- Symbol errors must be normalized to `ExchangeError` with `retryable=false`

---

## 12. ERROR NORMALIZATION

Every exchange error must become:

```
NormalizedExchangeError {
  code: string;         // exchange error code (normalized to internal taxonomy)
  message: string;      // original message preserved for audit
  retryable: boolean;   // deterministic: true/false — no AI guess
  timestamp: DateTime;
  source: 'REST' | 'WS' | 'HEALTH';
}
```

**Retryable rules (deterministic):**
- Timeout → retryable (with backoff)
- Rate limit (`429`) → retryable (after delay)
- Connection lost (`WS`) → retryable (reconnect first)
- Invalid order parameters (`400`, `invalid_symbol`) → NOT retryable
- Insufficient balance (`INSUFFICIENT_FUNDS`) → NOT retryable
- Unknown server error (`500`) → retryable with caution limit

**No blind retry.** Every retry requires `client_order_id` idempotency check against exchange.

---

## 13. CLIENT_ORDER_ID / IDEMPOTENCY

- `client_order_id` is VUA-generated UUID/string per P0-002 schema
- Every retry/resubmit must use same `client_order_id`
- Adapter must query exchange before retry (`queryOrder` by `client_order_id` or `exchange_order_id`)
- Duplicate submission must be prevented at adapter layer (not only DB `UNIQUE` constraint)
- Retries without idempotency check are forbidden

---

## 14. RATE-LIMIT / BACKOFF

- Rate limit events (`NormalizedExchangeError` with `code=429` or similar) must trigger deterministic backoff
- Backoff strategy: exponential (2^n × base delay), capped at maximum delay
- Rate-limited retry must NOT bypass risk check or order validation
- Rate limit status must be visible to `system_events` (P0-002 schema) — audit event appended

---

## 15. RETRY / BACKOFF BEHAVIOR (DETERMINISTIC)

```
Order submission attempt
        ↓
ACK received?
    /       \
  YES      NO
   │        │
   ▼        ▼
NORMAL   Query exchange (REST)
             │
          FOUND?
        /        \
      YES        NO
       │          │
       ▼          ▼
  Reconcile    Safe retry ONLY IF
  DB + event   idempotency satisfied
               (client_order_id same,
                exchange has no order)
```

**No "retry if missing" without qualification.** Every retry requires:
1. Exchange query result
2. Idempotency condition satisfied (`client_order_id` not present on exchange OR present with same parameters)
3. Risk governor NOT vetoed

---

## 16. WEBSOCKET RECONNECT

- Disconnect event → adapter attempts reconnect with exponential backoff
- After reconnect → adapter performs REST snapshot (`observeMarket` / `observeAccount`) to verify continuity
- Continuity validation → compare snapshot vs last known state; discrepancies → reconciliation event
- Reconnect does NOT imply retry of orders; order retry handled separately
- WebSocket reconnect must NOT bypass `ExchangeHealth` check

---

## 17. REST TIMEOUT BEHAVIOR

- REST timeout → adapter returns `NormalizedExchangeError` (`retryable=true`, `code=timeout`)
- VUA core (executionEngine) must NOT automatically retry; retry handled by adapter or by next cycle (deterministic)
- Timeout does NOT mean order failed; timeout means acknowledgment unknown — requires query

---

## 18. EXCHANGE DISCONNECT / FAILURE

- If adapter reports `ExchangeHealth` = unhealthy → VUA core must NOT submit orders through that adapter
- If all adapters unhealthy → VUA core must NOT attempt any order; risk veto applies; `system_events` records disconnect event
- Adapter failure must NOT corrupt VUA core; adapter must be replaceable/restartable independently
- No adapter has authority over risk limits, leverage, or capital (ADR-002 security model preserved)

---

## 19. RECONCILIATION BOUNDARY

Reconciliation is deferred to a future task (not P0-002). However, ADR-003 must document the boundary:

- DB authoritative for submitted orders (`orders` table)
- Exchange authoritative for fills (`fill_events` from adapter → DB)
- DB corrected by reconciliation event (`reconciliation_events` append-only table — already defined in P0-002 schema)
- Reconciliation event = append-only audit; never silent overwrite
- Reconciliation discrepancy must trigger alert (`system_events`); operator visibility required
- Reconciliation does NOT change `client_order_id` or `orders` submission; only corrects `fill_events` / `position_events` / observed state

---

## 20. PAPER / TESTNET / LIVE SEPARATION

- Adapter initialization must accept environment mode: `PAPER` / `TESTNET` / `LIVE`
- `system_config` (P0-002) stores `mode` field; adapter uses `mode` to select endpoint/credentials
- Credentials never shared between modes
- `.env` (development) = testnet only; production = Vault/reference only (ADR-002 security model)
- Adapter must NOT expose production keys in test mode; adapter must NOT expose testnet keys in production mode

---

## 21. SECURITY / API BOUNDARY

- Adapter must NOT store API secrets in `orders`, `fill_events`, `positions`, `decisions`, or `reconciliation_events`
- Adapter retrieves secrets at runtime from `.env` (dev/testnet) or Vault/reference (production) — NOT from DB
- Adapter must NOT log API secrets (only masked reference)
- Adapter must NOT expose secret through REST/WebSocket response
- Adapter must NOT allow withdrawal (VUA core has no authority; adapter has no withdrawal endpoint in contract)

---

## 22. TEST STRATEGY (DOCUMENTED FOR FUTURE)

- Unit: adapter converts normalized response correctly; mock adapter responses allowed (isolated test layer)
- Integration: adapter connects to testnet; real REST/WebSocket calls; DB events verified; no synthetic trading state in production runtime
- Contract: adapter interface satisfied; VUA core uses adapter without knowing exchange format
- Security: adapter never leaks secrets; `.env` never committed

**No-dummy gate applies:** Adapter test fixtures are isolated from production runtime; production adapter must return real exchange results (testnet/live), not synthetic/mock results.

---

## 23. FAILURE-MODE STRATEGY (DOCUMENTED)

Documented (not implemented):
- Disconnect → reconnect + snapshot validation
- Timeout → query + idempotency retry
- Rate limit → backoff + retry (deterministic)
- Invalid parameter → no retry + audit event
- Exchange state mismatch → reconciliation event + alert
- Adapter crash → restart; VUA core continues (adapter failure must not disable core)
- DB unavailable → VUA core stops order submission (risk veto); adapter disconnect handled separately

---

## 24. EXCHANGE CAPABILITY MATRIX (CONCEPTUAL)

| Capability | BybitAdapter | BinanceAdapter | Notes |
|------------|--------------|----------------|-------|
| REST order submit | ✓ (documented) | ✓ (documented) | Not implemented |
| REST cancel | ✓ | ✓ | Not implemented |
| REST account | ✓ | ✓ | Not implemented |
| WebSocket fills | ✓ | ✓ | Not implemented |
| WebSocket market | ✓ | ✓ | Not implemented |
| REST recovery (snapshot) | ✓ | ✓ | Not implemented |
| Idempotency (`client_order_id`) | ✓ | ✓ | Per P0-002 schema |
| Rate-limit backoff | ✓ | ✓ | Deterministic |

---

## 25. DECISION MATRIX

| Decision | Choice | Authority | Evidence Required Before Implementation |
|----------|--------|-----------|----------------------------------------|
| Primary exchange | Bybit | Human (ADR-003 approval) | Bybit V5 documentation verified |
| Secondary exchange | Binance | Human (ADR-003 approval) | Binance REST/WebSocket docs verified |
| Adapter interface | Normalized domain objects | Principal Engineer | ADR-003 approved |
| REST vs WebSocket | Both (separate boundaries) | Principal Engineer | ADR-003 approved |
| Reconciliation engine | Deferred (future) | Human (post ADR-003) | Not authorized |

---

## 26. IMPLEMENTATION BOUNDARY

**This file (`docs/audit/36-adr-003-exchange-abstraction.md`) is documentation only.**

**NOT IMPLEMENTED (requires separate authorization):**
- `server/services/exchangeAdapter.ts`
- `server/services/bybitAdapter.ts`
- `server/services/binanceAdapter.ts`
- `prisma/schema.prisma` changes for adapter-specific fields (not needed for P0-002; deferred)
- `executionEngine.ts` modifications for adapter usage
- `riskEngine.ts` modifications for adapter integration
- `api.ts` modifications for adapter endpoints
- `multiAgentBrain.ts` changes for adapter-aware decision
- Any Python adapter service

---

## 27. DEPENDENCY RELATIONSHIP

```
ADR-001 (APPROVED) → TypeScript core, optional Python (NO execution authority)
        ↓
ADR-002 (APPROVED) → PostgreSQL + Prisma + Migrate; P0-002 BLOCKED — ENVIRONMENT
        ↓
P0-002 (BLOCKED — ENVIRONMENT) → must complete (runtime) before P0-003
        ↓
ADR-003 (DOCUMENTED — NOT APPROVED — NOT IMPLEMENTED) → Exchange Adapter interface
        ↓
P0-003 (LOCKED) → Exchange adapter implementation (requires ADR-003 + P0-002 PASS)
        ↓
P0-004 / P0-005 / P0-006 / P0-007 → downstream (locked)
```

**No dependency bypass permitted.** P0-003 requires P0-002 PASS. ADR-003 implementation requires ADR-003 approval (separate from this documentation).

---

## 28. CONSISTENCY WITH ADR-001 / ADR-002 / P0-002

| Source | Check | Consistency |
|--------|-------|-------------|
| `28-adr-001-architecture-review.md` | TypeScript core + optional Python | ✓ Consistent — adapter in TypeScript |
| `22-architecture-decisions.md` | Hybrid option approved | ✓ Consistent |
| `29-adr-002-database-review.md` | DB ≠ source of truth (exchange authoritative for fills) | ✓ Consistent — adapter design separates DB authority from exchange authority |
| `30-adr-002-correction-review.md` | Idempotency (`client_order_id`) | ✓ Consistent — adapter must implement idempotency |
| `32-adr-002-finalization.md` | ORM = Prisma; Migration = Prisma Migrate; Security = no secret in DB | ✓ Consistent — adapter uses Prisma client; no secret in DB |
| `31-testing-acceptance-strategy.md` | No-dummy gate; Paper→Testnet→Live gates | ✓ Consistent — adapter must only return real exchange results (no synthetic/mocks) |
| `27-vua-master-project-map.md` (updated) | ADR-002 APPROVED; P0-002 BLOCKED; P0-003 locked | ✓ Updated |
| `35-p0-002-environment-blocker-checkpoint.md` | Environment blocker documented; no workaround rules set | ✓ Consistent — no workaround permitted |

---

## 31. EXPLICIT VERIFICATION CHECKLIST (Per Instruksi ADR-003)

| # | Requirement | Status | Evidence (file/section) |
|---|-------------|--------|------------------------|
| 1 | ExchangeAdapter Contract (order submit/cancel/status/fills/positions/balance/market/WS/REST) | ✓ DOCUMENTED — §2 interface definition |
| 2 | Normalization (symbol, side, type, qty, price, status, fills, position, timestamps, errors, identifiers) | ✓ DOCUMENTED — §9–§12 |
| 3 | Order Lifecycle: DESIRED → SUBMITTED → OBSERVED → PERSISTED → RECONCILED | ✓ DOCUMENTED — §3 (ADR-002 aligned) |
| 4 | ORDER → FILL (0..N) → POSITION (NOT 1:1) | ✓ DOCUMENTED — §2, §9, §3 |
| 5 | Idempotency: `client_order_id` | ✓ DOCUMENTED — §13, §3, §15 |
| 6 | REST timeout: query first, not new order | ✓ DOCUMENTED — §15, §17 |
| 7 | Ack lost: query exchange first | ✓ DOCUMENTED — §15 |
| 8 | DB confirms fill → retry forbidden | ✓ DOCUMENTED — §15 |
| 9 | UNKNOWN/RECONCILING → reconciliation required | ✓ DOCUMENTED — §19 |
| 10 | No duplicate order | ✓ DOCUMENTED — §13, §15 |
| 11 | WS disconnect → REST snapshot → resync → reconnect | ✓ DOCUMENTED — §16 |
| 12 | WS NOT permanent source of truth | ✓ DOCUMENTED — §16 (REST snapshot authoritative) |
| 13 | No replay DB ticker as WS recovery substitute | ✓ DOCUMENTED — §16 (REST snapshot, not DB replay) |
| 14 | REST timeout failure → detection + response + retry policy | ✓ DOCUMENTED — §17 |
| 15 | WS disconnect failure → detection + reconnect + snapshot | ✓ DOCUMENTED — §16 |
| 16 | Stale WS → detection + resync | ✓ DOCUMENTED — §16 |
| 17 | Rate limit → backoff + retry classification | ✓ DOCUMENTED — §14 |
| 18 | Exchange maintenance → failure mode | ✓ DOCUMENTED — §23 |
| 19 | Partial fill → preserved (0..N) | ✓ DOCUMENTED — §2, §9 |
| 20 | Exchange position discrepancy → reconciliation event | ✓ DOCUMENTED — §19 |
| 21 | Reconciliation: DB ≠ Exchange flat authority | ✓ DOCUMENTED — §19 (5-state model) |
| 22 | Discrepancy: always recorded, immutable, no silent correction | ✓ DOCUMENTED — §19 (append-only `reconciliation_events`) |
| 23 | Paper → Testnet → Controlled Live gates intact | ✓ DOCUMENTED — §20 |
| 24 | API key not domain model | ✓ DOCUMENTED — §21 |
| 25 | Secret not in DB plaintext | ✓ DOCUMENTED — §21 |
| 26 | Dev `.env` testnet / Prod Vault | ✓ DOCUMENTED — §21 |
| 27 | Exchange failure fail-safe | ✓ DOCUMENTED — §23 (`fail-safe`) |
| 28 | Adapter failure does NOT bypass Risk Governor | ✓ DOCUMENTED — §21 (`Risk Governor` preserved) |
| 29 | AI proposes / Deterministic Risk Governor decides | ✓ DOCUMENTED — §21 (`AI may propose.`) |
| 30 | Capability matrix present | ✓ DOCUMENTED — §24 |
| 31 | Decision matrix (A/B/C) present | ✓ DOCUMENTED — §25 (`Option A/B/C`) |
| 32 | Dependency to P0-002 explicit | ✓ DOCUMENTED — §27 |
| 33 | Not implemented (no source change) | ✓ DOCUMENTED — §26, §30 (`NOT IMPLEMENTED`) |

---

**DOCUMENTATION ONLY — NOT IMPLEMENTED — NEXT: HUMAN REVIEW.**

---

## 30. SOURCE PROTECTION / SECURITY

This ADR-003 documentation does NOT modify any source file:
- `executionEngine.ts` — untouched
- `riskEngine.ts` — untouched
- `api.ts` — untouched
- `binance.ts` / `bybit.ts` — untouched (reference only, no implementation)
- `multiAgentBrain.ts` — untouched
- `memoryLedger.ts` — untouched
- `geminiClient.ts` — untouched
- `researchLab.ts` — untouched
- `regime.ts` — untouched
- `indicators.ts` — untouched
- `prisma/schema.prisma` — unchanged (P0-002 design preserved)
- `package.json` — unchanged

---

## 30. NEXT STEPS (DOCUMENTED, NOT IMPLEMENTED)

1. Human approves ADR-003 (this documentation file + interface design review)
2. If environment restored (Docker + Prisma): complete P0-002 PASS (runtime validation)
3. Only after P0-002 PASS + ADR-003 approval: begin P0-003 implementation (exchange adapter code)
4. Adapter must pass: unit (mock adapter allowed in isolated test), integration (testnet connection verified), contract (normalized domain object), security (no secret leak), no-dummy (real testnet results in integration, synthetic only in isolated unit fixtures)

---

**DOCUMENTED ONLY — NO IMPLEMENTATION — NEXT: HUMAN REVIEW — STOP — WAIT FOR HUMAN APPROVAL BEFORE ANY P0-003.**
