# ADR-002 TESTING & ACCEPTANCE STRATEGY

**Status:** DRAFT — PENDING HUMAN DECISION. Documentation only.
**Depends on:** ADR-001 (APPROVED), ADR-002 (PENDING).
**Purpose:** Define testing layers, acceptance criteria, and gates that prove VUA is becoming a real trading system, not a prototype.

**Hard principle:** "AI may propose. Deterministic Risk Governor decides whether execution is permitted." — tests must enforce this, not bypass it.

---

## 1. TESTING PYRAMID

| Layer | Purpose | Real Exchange? | Real DB? | Synthetic? | Speed |
|---|---|---|---|---|---|
| **Unit** | Test single function/class in isolation (Kelly, R:R math, indicator calc, regime classifier) | No | No | Yes (input/output fixtures) | <1ms |
| **Integration** | Test interaction between services (riskEngine + executionEngine, multiAgentBrain + indicators) | No | Yes (test container) | Mixed | 10–100ms |
| **Contract** | Validate DB schema vs TypeScript types, exchange adapter vs API spec | No | Yes | Mock exchange responses | 100ms |
| **Database** | Test migrations, constraints, indexes, transactions, idempotency keys | No | Yes (test DB) | N/A | 1–10s |
| **Exchange Adapter** | Test REST/WebSocket with mock exchange (Binance/Bybit testnet) | Testnet | Yes | Some | 1–60s |
| **Reconciliation** | Test DB ↔ Exchange discrepancy detection, classification, correction, audit | Testnet | Yes | Seeded mismatch scenarios | 1–60s |
| **Recovery** | Test crash + restart scenarios (10 documented) | No | Yes | Crash-injection (kill process) | 30–300s |
| **End-to-End** | Full decision → risk → order → fill → position → reconcile loop | Testnet | Yes | No | 1–10min |
| **Paper** | VUA in paper mode, real market data, no real money | No (paper) | Yes | No (live data) | Days |
| **Testnet** | VUA on Binance/Bybit testnet with real connector | Yes (testnet) | Yes | No | Days–weeks |
| **Live-Readiness** | Final gate: every category below must pass | Yes (testnet only) | Yes | No | One-time |

**Mandatory rule:** Each layer must be 100% green before promotion.

---

## 2. RISK ENGINE ACCEPTANCE

Hard veto MUST never be bypassed. AI may propose; RiskGovernor decides.

### Test Cases (pass/fail)

| # | Test | Pass | Fail |
|---|------|------|------|
| RE-01 | Single trade risk exceeds `maxRiskPerTradePercent` | Trade REJECTED | Trade approved |
| RE-02 | Position count exceeds `maxOpenPositions` | REJECTED | Approved |
| RE-03 | Total leveraged exposure > `maxTotalExposureLeveraged` | REJECTED | Approved |
| RE-04 | R:R < `minRiskRewardRatio` | REJECTED | Approved |
| RE-05 | SL distance < 0.25% or > 6% of entry | REJECTED | Approved |
| RE-06 | SL on wrong side (long SL above entry, short SL below entry) | REJECTED | Approved |
| RE-07 | `currentEquityUsd = 0` or negative | REJECTED | Approved |
| RE-08 | Missing market data (ticker null, orderbook null) | REJECTED | Approved |
| RE-09 | Stale data (`timestamp` > N seconds ago) | REJECTED | Approved |
| RE-10 | Spread > `slippageLimitPercent` | REJECTED | Approved |
| RE-11 | Daily drawdown >= `maxDailyDrawdownPercent` (CB trip) | REJECTED + kill switch candidate | Approved |
| RE-12 | Kill switch engaged | REJECTED | Approved |
| RE-13 | Duplicate symbol already open | REJECTED (single-asset guard) | Approved |
| RE-14 | Recommendation: leverage > `maxLeverage` | Cap applied | Recommended as-is |
| RE-15 | Position size > `equity * maxLeverage` | Cap applied | Overflow |
| RE-16 | Insufficient balance (sizing > available) | REJECTED | Approved |
| RE-17 | Hypothetical position with `edgeProbability = NaN` | REJECTED | Approved |
| RE-18 | AI verdict `VETO_HIGH_RISK` | REJECTED | Approved |
| RE-19 | AI confidence < 65% | REJECTED (no-trade) | Approved |
| RE-20 | Risk engine bypass attempt (direct execute without risk check) | Runtime error | Succeeds |

**Pass criteria:** RE-01..RE-20 all pass on each CI run. Zero exceptions.

---

## 3. ORDER IDEMPOTENCY ACCEPTANCE

**Critical:** One logical order must NEVER become multiple orders.

| # | Test | Pass | Fail |
|---|------|------|------|
| OI-01 | Submit order with `client_order_id = X` | Exchange has 1 order | Exchange has 2+ |
| OI-02 | Retry after timeout with same `client_order_id` | Exchange idempotency returns same order | New order created |
| OI-03 | REST POST /api/trade/execute with same `idempotency_key` | Same result returned | New execution |
| OI-04 | Process crash after DB `orders` insert, before exchange call | On restart: query exchange, recover state | Duplicate order |
| OI-05 | Lost ACK, exchange already has order | DB reconciled, no re-submit | Re-submit creates duplicate |
| OI-06 | WebSocket + REST both report same fill | DB `UNIQUE(exchange_fill_id, symbol, timestamp)` rejects duplicate | Two `fill_events` rows |
| OI-07 | Retry of `client_order_id` with status = FILLED | Reject retry (FORBIDDEN) | Retry executes |
| OI-08 | Retry during RECONCILING state | Block retry, require reconciliation first | Retry executes |
| OI-09 | DB has fill for `client_order_id`, exchange shows order active | Reconciliation event logged; status updated to FILLED | Re-submit |

**Pass criteria:** OI-01..OI-09 all green. `client_order_id` constraint enforced at DB and exchange.

---

## 4. FILL / POSITION ACCEPTANCE

Test the `ORDER → FILL (0..N) → POSITION` relationship.

| # | Test | Expected State |
|---|------|----------------|
| FP-01 | Full fill (1 fill = full quantity) | Order FILLED, position opened, fill_event recorded |
| FP-02 | Partial fill (50% of qty) | Order PARTIALLY_FILLED, position 50% size, fill_event sequence 1 |
| FP-03 | Multiple fills to 100% | Order FILLED, position full, fill_events sequence 1, 2, 3 |
| FP-04 | Two orders scale-in to same position | Single position, weighted avg entry, two order rows, multiple fill_events |
| FP-05 | Scale-out (partial close) | Position quantity reduced, realized PnL recorded, position_event for close |
| FP-06 | Reversal (long → short via close + open) | Old position CLOSED, new position OPENED with opposite side |
| FP-07 | Fee deducted on fill | `fill_events.fee_usd` recorded; realized PnL includes fee |
| FP-08 | Funding payment | `position_events` records funding; balance adjusted |
| FP-09 | Realized PnL on close | `closed_trades.realized_pnl_usd` correct, includes fees |
| FP-10 | Unrealized PnL on tick | `positions.unrealized_pnl_usd` updated (derived; not authoritative) |
| FP-11 | SL triggered | position_event SL_TRIGGERED, fill_event, position CLOSED |
| FP-12 | TP1, TP2, TP3 triggered sequentially | Multiple position_events; trailing stop updated; correct quantity closed |
| FP-13 | Liquidation | position_event LIQUIDATED, position CLOSED |
| FP-14 | Order REJECTED by exchange | order status REJECTED, no position, no fill |
| FP-15 | Order CANCEL_REQUESTED → CANCELLED | Order CANCELLED, no position opened if cancelled before fill |

**Pass criteria:** All transitions produce correct DB state. Immutability preserved: `fill_events` and `position_events` never updated.

---

## 5. RECONCILIATION ACCEPTANCE

Test the discrepancy detection → classification → correction → audit pipeline.

| # | Scenario | Expected |
|---|----------|----------|
| RC-01 | DB = Exchange (consistent) | No event; no alert |
| RC-02 | DB has order, Exchange has order (matching `client_order_id`) | No event |
| RC-03 | DB missing order, Exchange has order | reconciliation_event `ORDER_MISMATCH`; insert DB order from exchange data |
| RC-04 | DB has order, Exchange missing | reconciliation_event; check fill_events; if filled: update DB to FILLED; if not: REJECTED |
| RC-05 | DB position qty ≠ Exchange qty (DB larger) | reconciliation_event `POSITION_MISMATCH`; correct to exchange qty (exchange wins) |
| RC-06 | DB position qty ≠ Exchange qty (Exchange larger) | reconciliation_event; correct DB to exchange qty |
| RC-07 | DB has fill, Exchange missing | reconciliation_event `FILL_MISMATCH`; investigate; never delete DB fill (immutable) |
| RC-08 | Exchange has fill, DB missing | reconciliation_event; insert DB fill from exchange |
| RC-09 | DB price > 5% from exchange price | reconciliation_event `PRICE_ANOMALY`; alert |
| RC-10 | Multiple discrepancies in single cycle | Multiple events; all logged; no silent correction |

**Pass criteria:** All scenarios produce immutable `reconciliation_events`. Corrections only after event. Operator alert. No historical event modification.

---

## 6. DATABASE FAILURE ACCEPTANCE

| # | Test | Safe Behavior |
|---|------|---------------|
| DB-01 | DB unavailable at startup | VUA refuses to start (no live trading) |
| DB-02 | DB unavailable mid-operation | Trading halts; new orders blocked; reconciliation paused |
| DB-03 | DB timeout (>5s) | Retry with backoff; after 3 fails: trading halt + alert |
| DB-04 | Transaction rollback (e.g., constraint violation) | All operations in tx rolled back; partial state impossible |
| DB-05 | Partial write (connection lost mid-insert) | DB tx atomicity: either all or none |
| DB-06 | Process crash after DB commit | On restart: state reconstructed from DB (no loss) |
| DB-07 | Process crash before DB commit | On restart: re-attempt operation; no phantom record |
| DB-08 | DB restored from backup | Reconciliation cycle compares current vs exchange; rebuilds if needed |
| DB-09 | DB full / disk full | Alert; no writes; trading halt |
| DB-10 | DB connection pool exhausted | Retry queue; after timeout: halt + alert |

**Pass criteria:** Zero data loss; zero orphan records; trading halts on critical failures; recovery is automatic.

---

## 7. EXCHANGE FAILURE ACCEPTANCE

| # | Test | Trading Behavior |
|---|------|-----------------|
| EX-01 | REST timeout (POST /order) | Retry with same `client_order_id`; idempotent |
| EX-02 | WebSocket disconnect mid-stream | Reconnect; fetch REST snapshot; resync state; validate continuity |
| EX-03 | Exchange unavailable (HTTP 503) | Retry with backoff; if persistent: paper continues (synthetic disabled), live halts |
| EX-04 | Delayed ACK (>30s) | Query exchange by `client_order_id`; reconcile |
| EX-05 | Order REJECTED by exchange (insufficient margin) | DB status REJECTED; reconciliation_event; alert |
| EX-06 | Rate limit hit (HTTP 429) | Backoff; do not submit duplicate |
| EX-07 | Malformed JSON response | Treat as exchange disconnect; retry |
| EX-08 | Stale market data (timestamp > 5s) | Risk REJECTED; no new orders until fresh data |
| EX-09 | Order status OUT_OF_SYNC (exchange shows different than DB) | Reconciliation event; correct to exchange |

**Pass criteria:** Trading halts on persistent failure. No duplicate orders. No silent fallback to mock.

---

## 8. MARKET DATA ACCEPTANCE

| # | Test | Result |
|---|------|--------|
| MD-01 | Stale candle (last > 5 min old) | Regime = UNKNOWN; no trading |
| MD-02 | Missing candle gap | Reconnect; fetch REST snapshot |
| MD-03 | WebSocket gap (no event > 10s) | Reconnect; continuity check |
| MD-04 | REST snapshot timestamp ≠ WebSocket last event | Reject WebSocket; use REST until consistency |
| MD-05 | Invalid timestamp (e.g., 1970-01-01) | Reject; data quality error |
| MD-06 | Out-of-order event (older than last) | Buffer; do not overwrite newer state |
| MD-07 | Duplicate event (same timestamp) | Dedupe by `(symbol, exchange, timestamp)` |
| MD-08 | Reconnect after disconnect | Validate gap; reconcile positions |
| MD-09 | Orderbook depth insufficient (< 5 levels) | Risk REJECTED (slippage check) |

**Pass criteria:** Market data health is binary. Stale or invalid = no trading.

---

## 9. STATE MACHINE ACCEPTANCE

Every state transition must be validated.

### Order States

| From | To | Allowed? | Recovery |
|------|----|----------|----------|
| CREATED | RISK_APPROVED | Yes | — |
| CREATED | REJECTED | Yes (risk veto) | — |
| RISK_APPROVED | SUBMITTING | Yes | — |
| SUBMITTING | SUBMITTED | Yes | — |
| SUBMITTING | UNKNOWN | Yes (timeout) | Query exchange |
| SUBMITTED | ACKNOWLEDGED | Yes | — |
| SUBMITTED | REJECTED | Yes (exchange reject) | — |
| ACKNOWLEDGED | PARTIALLY_FILLED | Yes | — |
| ACKNOWLEDGED | FILLED | Yes | — |
| ACKNOWLEDGED | CANCEL_REQUESTED | Yes | — |
| CANCEL_REQUESTED | CANCELLED | Yes | — |
| PARTIALLY_FILLED | FILLED | Yes | — |
| PARTIALLY_FILLED | CANCEL_REQUESTED | Yes (remainder cancelled) | — |
| UNKNOWN | RECONCILING | Yes | Query exchange |
| RECONCILING | ACKNOWLEDGED / FILLED / REJECTED | Yes (after reconcile) | — |
| FILLED | (terminal) | No further | — |
| CANCELLED | (terminal) | No further | — |
| REJECTED | (terminal) | No further | — |
| FILLED → SUBMITTING | INVALID | Blocked; assert | — |

### Position States

OPEN → CLOSED_MANUAL | CLOSED_CIRCUIT_BREAKER | CLOSED_KILL_SWITCH | LIQUIDATED. Terminal = CLOSED. No re-open.

### Risk States

NORMAL → WARNING (drawdown >= 2.0%) → TRIPPED (drawdown >= max). TRIPPED → NORMAL only after manual reset.

**Pass criteria:** All invalid transitions blocked at runtime with assertion/log. No silent skip.

---

## 10. DATABASE ACCEPTANCE

- Schema matches design (11 entities + relations)
- All UNIQUE constraints enforced (`client_order_id`, `exchange_fill_id`, etc.)
- All FKs enforced; orphans impossible
- Indexes justified and present: `(symbol, exchange, status)`, `(client_order_id, exchange, symbol)`, `fill_events(order_id)`, `fill_events(timestamp)`, `(symbol, exchange, interval, timestamp)`
- Transactions atomic; no partial writes
- Event tables append-only; app cannot UPDATE/DELETE (revoke permission)
- Migration reversible (down migration tested)
- Backup tested; restore tested
- Recovery: replay events; positions reconstructed

---

## 11. SECURITY ACCEPTANCE

| # | Test | Pass |
|---|------|------|
| SEC-01 | Exchange secret in `liveApiCredentials` plaintext in DB | REJECT (store reference only) |
| SEC-02 | `GEMINI_API_KEY` exposed in logs | REJECT (redact) |
| SEC-03 | DB user with DROP/ALTER permission | REJECT (least privilege) |
| SEC-04 | Migration user with INSERT/UPDATE on audit tables | REJECT (audit immutable) |
| SEC-05 | Production `.env` committed to repo | REJECT |
| SEC-06 | Testnet keys in production | REJECT |
| SEC-07 | Audit table directly modified | REJECT (permission revoked) |
| SEC-08 | SQL injection in API endpoint | REJECT (parameterized queries) |
| SEC-09 | Unencrypted DB connection | REJECT (SSL required) |
| SEC-10 | Plaintext secret in error message | REJECT (redact) |

---

## 12. PAPER GATE (PROMOTE TO TESTNET)

Mandatory before testnet:
- [ ] All Unit + Integration + Database tests pass (100%)
- [ ] Risk engine acceptance RE-01..RE-20 pass
- [ ] Order idempotency OI-01..OI-09 pass
- [ ] Reconciliation RC-01..RC-10 pass
- [ ] State machine transitions valid
- [ ] 72h paper run with no data loss; no crash
- [ ] All events recorded; reconciliation events present (even if no discrepancies)
- [ ] No silent synthetic fallback
- [ ] Logs reviewed; no secret leakage

## 13. TESTNET GATE (PROMOTE TO CONTROLLED LIVE)

Mandatory before live:
- [ ] All Paper Gate criteria pass
- [ ] All Exchange Failure tests EX-01..EX-09 pass on testnet
- [ ] All Market Data tests MD-01..MD-09 pass on testnet
- [ ] Reconciliation runs on testnet daily; all events logged
- [ ] Recovery tests (10 scenarios) pass on testnet
- [ ] 14-day testnet run: no false fills; no missed fills; equity curve matches expected
- [ ] Risk engine never bypassed
- [ ] Audit tables immutable (test DELETE attempt: rejected)
- [ ] DB backup + restore tested
- [ ] Security tests SEC-01..SEC-10 pass

## 14. LIVE-READINESS GATE

| Category | Pass Criteria |
|----------|---------------|
| **Architecture** | ADR-001 (APPROVED), ADR-002 (APPROVED), all ADRs approved; TypeScript core confirmed; no Python execution authority |
| **Database** | 11 entities deployed; constraints enforced; backup/restore tested; event immutability verified |
| **Risk** | RE-01..RE-20 pass; kill switch tested; circuit breaker tested |
| **Execution** | OI-01..OI-09 pass; live connector tested on testnet; HMAC signing implemented |
| **Reconciliation** | RC-01..RC-10 pass; runs daily + on-demand; all events immutable |
| **Market Data** | MD-01..MD-09 pass; gap detection works; reconnect works |
| **Security** | SEC-01..SEC-10 pass; secrets via Vault; no plaintext in DB or logs |
| **Recovery** | All 10 crash scenarios pass; no data loss; no orphan records |
| **Observability** | Logs, metrics, alerts; reconciliation events visible; kill switch visible |
| **Testing** | 100% pass on all layers above; coverage report; CI green for 14 days |
| **Documentation** | All audit docs; runbooks; incident response plan; on-call playbook |

---

## 15. NO-DUMMY / NO-HALU GATE

VUA must NOT use synthetic/mocked data in production paths. Mocks ONLY where explicitly allowed.

| Path | Allowed in Production? | Where Mocks Allowed |
|------|------------------------|---------------------|
| Live ticker | NO (real WebSocket/REST) | Unit + Integration tests |
| Order book | NO | Unit + Integration tests |
| OHLCV candles | NO (real exchange or DB historical) | Backtest (DB historical) |
| Execution | NO (real exchange or testnet) | Testnet gate only |
| Fill events | NO (real exchange) | Testnet gate only |
| Indicators | NO (compute from real candles) | Unit + backtest |
| Regime | NO (compute from real indicators) | Unit + backtest |
| Multi-agent debate | NO (real LLM) | Unit (mock LLM only) |
| Risk engine | NO (real config) | Unit + Integration (controlled scenarios) |
| Persistence | NO (real DB) | Unit (in-memory) + Integration (test DB) |

**Test:** Production code path must NOT contain `if (process.env.NODE_ENV === 'development') { use mock }` — mocks only via dependency injection at test boundary.

**Test:** `dispatchToLiveExchange` must NOT log and return — must call real exchange.

**Test:** `generateSyntheticCandles` (currently in `researchLab.ts`) must NEVER be called outside backtest path. Lint rule or runtime check.

**Test:** `liveApiCredentials` must NOT be empty when `mode === 'LIVE'`. Runtime check.

**Test:** Kill switch must NOT silently fall back to "ignore" on error.

**Test:** `memoryLedger` equity calculation must NOT be hardcoded seed in production.

**Test:** Any `console.log` with `apiKey`, `secret`, `key`, or `token` substring must be linted against in CI.

---

## 16. DEFINITION OF DONE

### P0 (Critical Path)

- [ ] All tests in layers 1–7 pass
- [ ] Risk engine acceptance (20 tests) green
- [ ] Order idempotency (9 tests) green
- [ ] Reconciliation (10 tests) green
- [ ] Database failure (10 tests) green
- [ ] State machine all transitions validated
- [ ] No dummy/no-halu gate green
- [ ] Source code reviewed (principal engineer sign-off)
- [ ] All audit docs linked and current
- [ ] CI pipeline green for 7 consecutive days

### P1 (High Priority)

- [ ] All P0 criteria met
- [ ] Exchange failure tests (9 tests) green
- [ ] Market data tests (9 tests) green
- [ ] Paper gate green (72h clean run)
- [ ] Security tests (10 tests) green
- [ ] Observability dashboard live

### P2 (Medium)

- [ ] All P1 met
- [ ] Testnet gate green (14-day run, clean reconciliation)
- [ ] Reconciliation reports reviewed
- [ ] Runbooks published
- [ ] Incident response tested

### P3 (Low / Hardening)

- [ ] All P2 met
- [ ] Performance benchmarks met (latency, throughput)
- [ ] Disaster recovery tested (DB loss + restore)
- [ ] On-call rotation active

### Paper

- [ ] All P0–P1 met
- [ ] 30-day paper run with no critical bugs
- [ ] Equity curve matches backtest within tolerance
- [ ] All reconciliation events reviewed

### Testnet

- [ ] All Paper criteria met
- [ ] 60-day testnet run; reconciliation events clean
- [ ] No live trading risk

### LIVE READINESS

- [ ] All Testnet criteria met
- [ ] Live-readiness gate (all 11 categories) green
- [ ] Independent review by second engineer
- [ ] Compliance review (if applicable)
- [ ] Human Principal Engineer explicit go/no-go decision

### Final Project

- [ ] All LIVE READINESS criteria met
- [ ] 90-day controlled live run with monthly review
- [ ] All P0–P3 tasks complete
- [ ] Audit docs archived; runbooks live
- [ ] Operator training complete

---

## 17. ADR-002 IMPLEMENTATION READINESS

**Status check after testing strategy:**

| Criterion | Status |
|-----------|--------|
| Source of truth hierarchy | ✓ Ready (corrected in 30) |
| Lifecycle states | ✓ Ready (12+ states) |
| Schema relationships | ✓ Ready (ORDER → FILL 0..N → POSITION) |
| Event model | ✓ Ready (append-only) |
| Idempotency | ✓ Ready (`client_order_id` + DB unique) |
| Reconciliation | ✓ Ready (event-first correction) |
| Recovery (10 scenarios) | ✓ Ready |
| Transaction boundaries | ✓ Ready (DB-only atomic) |
| Security | ✓ Ready (Vault reference, no plaintext) |
| Retention | ✓ Ready (HOT/WARM/COLD/EPHEMERAL) |
| Migration | ✓ Ready (phased) |
| **Testing/Acceptance** | ✓ **NOW READY** (this document) |

**ADR-002 IMPLEMENTATION READINESS: YES** — all 12 criteria met.

**However:** Implementation still requires human approval of ADR-002 (status remains PENDING). This document unblocks the final ambiguity; it does not approve the ADR.

---

## REMAINING AMBIGUITIES

None technical. Remaining items are operational:
- ORM choice (Prisma recommended) — formal selection pending
- Migration tool (Prisma Migrate or raw SQL) — pending
- Backup strategy (provider, frequency, retention) — pending
- Vault provider (HashiCorp Cloud, AWS Secrets Manager, self-hosted) — pending
- Observability stack (logs/metrics/traces) — pending

These are implementation choices, not ADR blockers.

---

## ADR-002 STATUS

**PENDING HUMAN DECISION.** Agent does NOT approve.

## NEXT HUMAN DECISION

1. Approve ADR-002 (PostgreSQL + Prisma + testing strategy).
2. Select ORM (recommend Prisma).
3. Authorize TASK-P0-002 (PostgreSQL init) to begin.
4. Define backup strategy + vault provider.

**STOP.** Documentation only. No PostgreSQL. No Prisma. No source modification. No `package.json` change. No exchange code change. No risk engine change. No execution engine change. Trader Brain DISABLED.

---

## FILES UPDATED / CREATED

- Created: `docs/audit/31-testing-acceptance-strategy.md` (this file)
- Referenced (no changes needed): `docs/audit/29-adr-002-database-review.md`, `30-adr-002-correction-review.md`, `22-architecture-decisions.md`, `27-vua-master-project-map.md`, `00-audit-summary.md`
- Source code: ZERO modifications
- Database: ZERO created
- Dependencies: ZERO installed
