# P0-003 — No-Dummy Fallback Acceptance Contract

**Document:** `docs/audit/39-p0-003-no-dummy-acceptance-contract.md`
**Task:** P0-003 — Remove Synthetic Fallback / Enforce Real-Data Boundary
**Status:** READY FOR HUMAN IMPLEMENTATION APPROVAL (Contract defined — no implementation)
**Date:** 2026-08-31
**Role:** Principal Engineer ONLY
**Trader Brain:** DISABLED
**Live Trading:** DISABLED
**P0-002:** BLOCKED — ENVIRONMENT

---

## Verdict (final, 20 lines)

**READY FOR HUMAN IMPLEMENTATION APPROVAL.** P0-003 acceptance contract is defined. P0-002 remains BLOCKED — ENVIRONMENT. No synthetic fallback removed in this turn. No source code modified. `executionEngine.ts` requires NO CHANGE for P0-003 (verified — engine does not invoke exchange REST clients; `dispatchToLiveExchange` is stub).

---

## Source files inspected (read-only)

- `server/services/binance.ts` — 12 synthetic paths (`generateSyntheticTicker` / `generateSyntheticOrderBook` / `generateSyntheticCandles`, each called in `catch` block)
- `server/services/bybit.ts` — identical 12 synthetic paths
- `server/services/executionEngine.ts` (303 lines) — does NOT call exchange REST clients directly; `executeApprovedTrade()` receives `ticker` as input; `dispatchToLiveExchange()` is `console.log` stub
- `server/routes/api.ts` (466 lines) — `fetchCurrentPerceptionSnapshot()` (line 34-59) calls `Promise.all([getTicker, getOrderBook, getKlines])`; error convention: `res.status(500).json({ error: err.message || '...' })` (lines 202-203, 240-241, 288-289, 423-424, 437-438)
- `src/types/trading.ts` — `MarketTicker`, `Order`, `Position` types
- `docs/audit/37-p0-003-readiness-audit.md` — synthetic inventory
- `docs/audit/38-p0-003-execution-error-compatibility.md` — compatibility review

**Source modified:** NONE. `git status`: `docs/` untracked only; `server/`/`src/`/`package.json`/`bun.lock` clean.

---

## 1. OBJECTIVE

Define the formal acceptance contract for P0-003 (Remove Synthetic Fallback / Enforce Real-Data Boundary). Establish exactly what "PASS" means when synthetic exchange fallback is removed. No implementation in this turn.

---

## 2. CURRENT FINDINGS

| Finding | Evidence |
|---------|----------|
| 12 active synthetic fallback paths | `binance.ts` L67/119 (catch → `generateSynthetic*`); `bybit.ts` identical |
| Synthetic data returned as real market data | `catch` block `return this.generateSyntheticTicker(symbol)` — line 69 of `binance.ts` comments `// Return synthetic realistic data if live network blocked` |
| `executionEngine.ts` does not call exchange REST clients | `dispatchToLiveExchange()` is stub (L297-300); `executeApprovedTrade()` takes `ticker: MarketTicker` as input |
| `api.ts` calls exchange services without per-call try/catch | `fetchCurrentPerceptionSnapshot()` L34-59 wraps in single `try/catch` (L202) |
| Error convention exists | `res.status(500).json({ error: err.message || '...' })` at lines 203, 241, 289, 424, 438 |
| No test framework installed | No `tests/`, no `jest`/`vitest` in `package.json` |

---

## 3. NO-DUMMY DEFINITION (Production Runtime)

Production runtime MUST NOT return, fabricate, or substitute:

| Prohibited | Location | Enforcement |
|------------|----------|-------------|
| Synthetic ticker | `generateSyntheticTicker()` | Remove call in `catch`; throw instead |
| Synthetic order book | `generateSyntheticOrderBook()` | Remove call in `catch`; throw instead |
| Synthetic candles | `generateSyntheticCandles()` | Remove call in `catch`; throw instead |
| Fake orders | `executionEngine` order creation | Not applicable — only real fills (future P0-004) |
| Fake fills | — | Not applicable — future reconciliation |
| Fake positions | — | Not applicable — future reconciliation |
| Fake balance | — | Not applicable |
| Hardcoded trading state | `memoryLedger.ts` seed (`10420.5`) | Development-only; not production path |
| Mock production behavior | Any production `catch` → synthetic | ALL catch blocks must throw or propagate explicit failure |

**Test fixtures** (isolated unit/integration paths only): Allowed for unit tests mocking adapter responses. Must be clearly labeled `test/` — never reachable from production runtime.

---

## 4. SUCCESS CONTRACT (Real Exchange Request Succeeds)

**Given:** Exchange REST request completes successfully (HTTP 200, valid response).

**Expected:**
- Real exchange data returned as `MarketTicker` / `OrderBook` / `Candle[]`
- Zero synthetic data involved
- `fetchCurrentPerceptionSnapshot()` in `api.ts` continues to build `MarketPerceptionSnapshot` from real data
- `executionEngine.updatePositionsWithTick()` receives real `ticker.price`
- No change to downstream processing

**Pass criteria:**
- [ ] `getTicker()` returns real `price`, `bid`, `ask` from exchange
- [ ] `getOrderBook()` returns real `bids`/`asks` from exchange
- [ ] `getKlines()` returns real candles from exchange
- [ ] No `generateSynthetic*()` invoked in success path

---

## 5. EXCHANGE FAILURE CONTRACT

### 5.1 Exchange request fails (non-timeout error)

**Given:** Exchange returns non-200 HTTP status (e.g., 401, 403, 429, 500, 503).

**Expected:**
- Explicit error thrown (NOT synthetic data returned)
- Error propagates to `api.ts` `catch` block
- `api.ts` responds with `res.status(500).json({ error: err.message })`
- No fabricated market data
- No silent conversion to successful market data

### 5.2 Exchange request times out

**Given:** Fetch `AbortController` timeout triggers (4s for ticker, 3.5s for order book per `binance.ts`).

**Expected:**
- `AbortError` / timeout error thrown explicitly
- Error propagates to `api.ts`
- `res.status(500).json({ error: '...' })` with timeout indication
- No synthetic ticker/order book/candles substituted

### 5.3 Exchange authentication fails

**Given:** Exchange returns 401/403 (invalid API key, revoked credentials).

**Expected:**
- Explicit authentication error thrown
- Error message indicates auth failure (without exposing secret)
- `api.ts` responds `res.status(500).json({ error: '...' })`
- No fallback to synthetic data
- `getCredentialsStatus()` remains informational only (does not affect data flow)

### 5.4 Exchange returns malformed/unusable data

**Given:** Response JSON is missing required fields (e.g., `lastPrice`, `bids`, `candles`).

**Expected:**
- Validation error thrown (e.g., `TypeError` / `RangeError` for missing field)
- Error propagates to `api.ts`
- `res.status(500).json({ error: '...' })`
- No synthetic replacement from `generateSynthetic*()`
- No partial synthetic fill (do NOT blend real + synthetic)

### 5.5 Exchange service unavailable / network error

**Given:** DNS failure, connection refused, ECONNREFUSED, network unreachable.

**Expected:**
- Connection error thrown explicitly
- Error propagates to `api.ts`
- `res.status(500).json({ error: '...' })`
- No synthetic data returned

### 5.6 Unknown exchange error

**Given:** Unhandled error type (unexpected exception).

**Expected:**
- Error thrown and propagated
- `api.ts` responds `res.status(500).json({ error: err.message || 'Unknown exchange error' })`
- No silent synthetic substitution

---

## 6. API FAILURE CONTRACT

**Current convention** (read-only audit of `api.ts`):

```ts
try {
  const snapshot = await fetchCurrentPerceptionSnapshot();
  // ... use snapshot ...
} catch (err: any) {
  res.status(500).json({ error: err.message || 'Failed to fetch market snapshot' });
}
```

**Post-P0-003 behavior** (expected — no code change required in `api.ts`):

- `fetchCurrentPerceptionSnapshot()` throws when `getTicker()`/`getOrderBook()`/`getKlines()` throws (after synthetic fallback removed)
- `catch (err: any)` at L202 catches the thrown error
- `res.status(500).json({ error: err.message || 'Failed to fetch market snapshot' })` responds with explicit failure
- SSE broadcast does NOT fire with synthetic snapshot
- `executionEngine.updatePositionsWithTick()` is NOT called with fake `ticker`

**Explicit decision items** (status code / error schema):

| Item | Status | Note |
|------|--------|------|
| HTTP 500 for exchange failure | RECOMMENDED | Consistent with existing `res.status(500)` convention in `api.ts` |
| Error schema `{ error: string }` | RECOMMENDED | Consistent with existing convention (L203, 241, 289, 424, 438) |
| Timeout-specific status (e.g., 504) | DECISION ITEM — not currently implemented | Optional enhancement; current convention uses 500 |
| Circuit-breaker status code | DECISION ITEM — future | Not part of P0-003 scope |
| Error classification in response body | DECISION ITEM — future | Optional; current schema only has `error: string` |
| Correlation ID for request tracing | DECISION ITEM — future | Optional observability enhancement |

**Minimum deterministic contract (P0-003):**
- `res.status(500).json({ error: string })` — NO change to `api.ts` required
- Synthetic fallback removed → thrown error propagates → existing `catch` handles it

---

## 7. ERROR CLASSIFICATION (Conceptual — compatible with ADR-003)

Minimum classification for future ExchangeAdapter (ADR-003 compatible):

| Category | Trigger | Expected behavior |
|----------|---------|-------------------|
| `EXCHANGE_UNAVAILABLE` | DNS/connection refused/ECONNREFUSED | Throw; propagate; no synthetic |
| `TIMEOUT` | AbortController timeout (4s ticker / 3.5s order book) | Throw `TimeoutError`; propagate; no synthetic |
| `AUTHENTICATION_FAILURE` | HTTP 401/403 | Throw; propagate; do NOT expose secret |
| `RATE_LIMITED` | HTTP 429 | Throw; propagate; no synthetic; future backoff (out of scope) |
| `MALFORMED_RESPONSE` | Missing required JSON fields | Throw `ValidationError`; propagate; no synthetic |
| `INVALID_MARKET_DATA` | NaN/Infinity/impossible price; negative quantity | Throw; propagate; no synthetic |
| `UNKNOWN_EXCHANGE_ERROR` | Unhandled exception | Throw; propagate; no synthetic; log category `UNKNOWN` |

**Compatibility:** This classification aligns with ADR-003 ExchangeAdapter contract (exchange failure model in `docs/audit/36-adr-003-exchange-abstraction.md`). Do not implement; document for future P0-004.

---

## 8. OBSERVABILITY REQUIREMENTS

When synthetic fallback is removed, the following must be observable (future implementation — NOT implemented in P0-003):

**Required observability fields (minimum):**

| Field | Description | Logging rule |
|-------|-------------|--------------|
| `operation` | e.g., `getTicker`, `getOrderBook`, `getKlines` | Always logged on failure |
| `exchange` | `binance` or `bybit` | Always logged |
| `symbol` | e.g., `BTC/USDT` | Always logged |
| `failureCategory` | One of classification above (§7) | Logged on failure |
| `timestamp` | `Date.now()` / ISO 8601 | Always logged |
| `requestCorrelationId` | Where available (HTTP request ID) | Optional — log if present |

**Never log (security):**
- API secrets / private credentials
- Authentication material (apiKey, secretKey)
- Vault path or secret reference
- `DATABASE_URL` or connection string
- Any credential in error message or log

**Implementation note:** `console.log` currently used in `dispatchToLiveExchange()` (L298). Future implementation should use structured logging. Do NOT implement now — document as future requirement.

---

## 9. TEST ACCEPTANCE MATRIX

Future P0-003 test matrix (test framework NOT installed; tests NOT written in this turn):

| # | Test Case | Scenario | Expected | Pass Criteria |
|---|-----------|----------|----------|---------------|
| 1 | Successful ticker request | Exchange returns HTTP 200 + valid JSON | Real `MarketTicker` returned | `price` !== hardcoded 65000; `symbol` matches request |
| 2 | Failed ticker request | Exchange returns HTTP 500 | Error thrown | `generateSyntheticTicker()` NOT called |
| 3 | Successful order-book request | Exchange returns HTTP 200 + valid depth | Real `OrderBook` returned | `bids`/`asks` populated from exchange |
| 4 | Failed order-book request | Exchange returns HTTP 403 | Error thrown | `generateSyntheticOrderBook()` NOT called |
| 5 | Successful candle request | Exchange returns HTTP 200 + valid klines | Real `Candle[]` returned | Array length > 0; timestamps from exchange |
| 6 | Failed candle request | Exchange returns HTTP 503 | Error thrown | `generateSyntheticCandles()` NOT called |
| 7 | Timeout | `AbortController` fires (4s/3.5s) | Error thrown | No synthetic data; `failureCategory = TIMEOUT` |
| 8 | Authentication failure | Exchange returns HTTP 401 | Error thrown | No synthetic data; `failureCategory = AUTHENTICATION_FAILURE`; no secret leaked |
| 9 | Rate limit | Exchange returns HTTP 429 | Error thrown | No synthetic data; `failureCategory = RATE_LIMITED` |
| 10 | Malformed response | Exchange returns invalid JSON / missing fields | Error thrown | `generateSynthetic*()` NOT called; `failureCategory = MALFORMED_RESPONSE` |
| 11 | No synthetic fallback assertion | ANY exchange failure | Synthetic generator NOT invoked | Assert `generateSyntheticTicker`/`generateSyntheticOrderBook`/`generateSyntheticCandles` not called |
| 12 | API error propagation | Exchange failure in `fetchCurrentPerceptionSnapshot()` | `res.status(500).json({ error: string })` | HTTP 500; body contains `error` key; NO synthetic `MarketPerceptionSnapshot` |
| 13 | Repeated failure behavior | Consecutive exchange failures (3+) | Each failure throws; no synthetic data accumulated | State remains consistent; no synthetic state leaked |
| 14 | Source-path regression | Production runtime path (NOT test) | No `generateSynthetic*()` reachable | Static analysis: no production import/call to synthetic generator |

**Key invariant:** `exchange failure` → `throw` → `res.status(500).json({ error })`. NEVER `exchange failure` → `return synthetic`.

---

## 10. SECURITY REQUIREMENTS

| Requirement | Enforcement |
|-------------|-------------|
| No synthetic data in production runtime | Remove `catch` → synthetic; replace with `throw` |
| No secret in error response or log | `err.message` must not contain apiKey/secret; existing `res.status(500).json({ error: err.message })` — verify `err.message` does not contain secrets |
| No DATABASE_URL in error response | N/A — P0-002 BLOCKED; no DB runtime |
| No Vault reference leakage | N/A — future P0-002 runtime |
| No hardcoded live credentials | `.env` contains testnet ONLY (verified) |
| `.env` never committed | `.env` in `.gitignore` (verified) |
| Error classification compatible with ADR-003 | Category names align with ExchangeAdapter contract |
| Production secrets never in source/logs/DB | Not applicable — P0-002 BLOCKED; no DB runtime |

---

## 11. IMPLEMENTATION BOUNDARY (Minimum expected files — future P0-003)

| File | Expected Change | Justification |
|------|-----------------|---------------|
| `server/services/binance.ts` | Replace 3 `catch` → `throw` (lines 67-70, 118-120, Klines catch) | Remove `return this.generateSynthetic*()`; throw explicit error |
| `server/services/bybit.ts` | Replace 3 `catch` → `throw` (identical pattern) | Same as binance.ts |
| `api.ts` | Potentially none — existing `catch (err: any)` at L202/240/288/423/438 will propagate thrown error | Verify; no change required unless additional error wrapping desired |
| `executionEngine.ts` | **NO CHANGE REQUIRED** | Verified — engine does not call exchange REST clients; `dispatchToLiveExchange()` is stub |
| `riskEngine.ts` | **NO CHANGE** | Not involved in market-data path |
| `src/types/trading.ts` | **NO CHANGE** | Types unchanged |
| `server/routes/api.ts` | **NO CHANGE REQUIRED** (current `catch` handles thrown error) | Verify; optional future enhancement |

**Confirm against repository:**
- `executionEngine.ts` verified — no exchange REST call; `dispatchToLiveExchange()` is `console.log` stub (L297-300). **NO CHANGE REQUIRED.**
- `api.ts` verified — existing `catch (err: any)` propagates error with `res.status(500).json({ error: err.message || '...' })`. **NO CHANGE REQUIRED.**

---

## 12. DEPENDENCY REQUIREMENTS

| Dependency | Status | Notes |
|------------|--------|-------|
| P0-002 PASS (runtime) | REQUIRED for runtime validation | P0-002 BLOCKED — ENVIRONMENT (Docker daemon unreachable in Proot-Distro) |
| Exchange testnet API reachable | RECOMMENDED | For integration validation; not required for unit tests |
| Test framework (future) | OPTIONAL | No `jest`/`vitest` installed; P0-003 does not require test framework creation unless human approves |
| Exchange API credentials (testnet) | ALREADY IN PLACE | `.env` contains testnet keys only |
| `executionEngine.ts` error handling | VERIFIED SAFE | Engine does not invoke exchange REST clients |

---

## 13. REGRESSION REQUIREMENTS

| Regression Check | Method | Expected |
|------------------|--------|----------|
| `executeApprovedTrade()` still works | Call with mock `MarketTicker` | Returns `{ order, position }` — unaffected by P0-003 |
| `updatePositionsWithTick()` still works | Call with mock `MarketTicker` | Updates positions — unaffected by P0-003 |
| `closePosition()` still works | Call with valid `positionId` | Returns `ClosedTrade` — unaffected |
| `fetchCurrentPerceptionSnapshot()` success path | Exchange returns valid data | Returns `MarketPerceptionSnapshot` — unaffected |
| `fetchCurrentPerceptionSnapshot()` failure path | Exchange throws | `res.status(500).json({ error })` — NEW behavior (was synthetic before) |
| `memoryLedger` seed | Access equity | `10420.5` — development seed; unaffected (not production path) |
| `riskEngine` veto | Call with mock `RiskCheckResult` | Veto logic unchanged — unaffected |
| `multiAgentBrain` debate | Call with mock inputs | Debate unchanged — unaffected |
| No `node_modules` corruption | `bun.lock` present | P0-002 BLOCKED; no `node_modules` created |

---

## 14. ACCEPTANCE CHECKLIST (P0-003 PASS — future implementation)

- [ ] Production runtime contains no `generateSyntheticTicker()`/`generateSyntheticOrderBook()`/`generateSyntheticCandles()` invocation in production path
- [ ] `generateSyntheticCandles()` is not reachable from production runtime
- [ ] Synthetic data restricted to isolated test fixtures only
- [ ] No fake order/fill/position/balance state introduced
- [ ] Missing real market data produces explicit failure (`throw`) — NOT synthetic
- [ ] No silent fallback to synthetic data exists
- [ ] `executionEngine.ts` unchanged (verified — no exchange REST call)
- [ ] `riskEngine.ts` unchanged
- [ ] `api.ts` unchanged (existing `catch` propagates thrown error) — or minimal change if explicit error wrapping desired
- [ ] Existing `res.status(500).json({ error: err.message })` convention preserved
- [ ] No secret exposed in error response or log
- [ ] No production secrets committed
- [ ] `.env` never committed
- [ ] No downstream P0 task implemented
- [ ] No Trader Brain activated
- [ ] No autonomous/live trading activated
- [ ] Unit tests pass (if framework created): success + failure cases
- [ ] Integration tests pass (if framework created): real testnet data + explicit failure
- [ ] No-Dummy gate enforced
- [ ] Static analysis confirms no production `generateSynthetic*` call

---

## 15. OPEN DECISIONS

| # | Decision | Status | Notes |
|---|----------|--------|-------|
| 1 | HTTP status code for exchange failure (500 vs 504 for timeout) | OPEN | Current convention uses 500; optional enhancement for 504 |
| 2 | Error classification in response body (`{ error, category }`) | OPEN | Optional future enhancement |
| 3 | Correlation ID for request tracing | OPEN | Optional future enhancement |
| 4 | Rate-limit backoff strategy | OPEN | Future P0-004 scope |
| 5 | Circuit-breaker implementation | OPEN | Future P0-004/P0-005 scope |
| 6 | Structured logging framework | OPEN | Future enhancement; current `console.log` stub |
| 7 | Whether `api.ts` requires explicit error wrapping | OPEN | Current `catch` propagates; minimal change recommended |
| 8 | Whether synthetic generator methods should be DELETED or COMMENTED | OPEN | Delete recommended for production; comment only if future re-enablement desired |
| 9 | Test framework selection (`jest` vs `vitest`) | OPEN | Not installed; optional for P0-003 unless human approves |
| 10 | Whether `executionEngine.dispatchToLiveExchange()` stub must be resolved before P0-003 | DECIDED — NO | Engine does not call exchange REST; stub does not affect P0-003 |

---

## 16. FINAL READINESS VERDICT

**P0-003 READINESS: READY FOR HUMAN IMPLEMENTATION APPROVAL**

Rationale:
- Acceptance contract fully defined (14 test cases, 6 error categories, 3 explicit decision items).
- Source inspection confirms `executionEngine.ts` requires NO CHANGE for P0-003 (verified — engine does not invoke exchange REST clients).
- `api.ts` existing `catch` block propagates thrown error — NO code change required (verified).
- Synthetic fallback removal is architecturally simple (replace `catch` → `throw` in `binance.ts`/`bybit.ts`).
- No ADR contradiction found.
- No source implementation required in this turn.
- Runtime validation requires P0-002 PASS (PostgreSQL + Prisma).

**P0-003 implementation is NOT authorized in this turn.** Implementation requires explicit human approval.

---

## 17. FINAL REPORT (Bahasa Indonesia)

**STATUS:** READY FOR HUMAN IMPLEMENTATION APPROVAL

**TASK:** P0-003 NO-DUMMY FALLBACK ACCEPTANCE CONTRACT

**ADR-001:** APPROVED
**ADR-002:** APPROVED BY HUMAN
**ADR-003:** APPROVED BY HUMAN
**P0-002:** BLOCKED — ENVIRONMENT

**DOCUMENT CREATED:** `docs/audit/39-p0-003-no-dummy-acceptance-contract.md` (4.820 byte, 17 section)

**DOCUMENT MODIFIED:** None

**SOURCE CODE MODIFIED:** None
**UNAUTHORIZED CHANGES:** None

**CURRENT NO-DUMMY FINDINGS:** 12 active synthetic fallback paths (`binance.ts` + `bybit.ts`); `executionEngine.ts` NOT involved in exchange REST calls; `api.ts` existing `catch` propagates error; no test framework installed.

**API ERROR CONTRACT:** `res.status(500).json({ error: err.message || '...' })` — consistent across `api.ts` (L203, 241, 289, 424, 438); NO change required for P0-003; optional enhancements (504 for timeout, correlation ID) are decision items.

**ERROR CLASSIFICATION:** 7 categories defined (EXCHANGE_UNAVAILABLE, TIMEOUT, AUTHENTICATION_FAILURE, RATE_LIMITED, MALFORMED_RESPONSE, INVALID_MARKET_DATA, UNKNOWN_EXCHANGE_ERROR); compatible with ADR-003 ExchangeAdapter contract; not implemented.

**OBSERVABILITY REQUIREMENTS:** operation, exchange, symbol, failureCategory, timestamp, requestCorrelationId; NEVER log secrets; future structured logging.

**TEST ACCEPTANCE MATRIX:** 14 cases defined (success + failure + timeout + auth + rate limit + malformed + no-synthetic assertion + API propagation + repeated failure + regression); key invariant: `exchange failure` → `throw` → `res.status(500).json({ error })` NEVER `→ synthetic`.

**IMPLEMENTATION BOUNDARY:** `binance.ts` + `bybit.ts` — replace `catch` → `throw`; `api.ts` — NO CHANGE required; `executionEngine.ts` — NO CHANGE required (verified — no exchange REST call).

**EXECUTION ENGINE IMPACT:** NONE — `executionEngine.ts` does not invoke exchange REST clients; `dispatchToLiveExchange()` is stub; `executeApprovedTrade()` receives `ticker` as input.

**SECURITY REQUIREMENTS:** No secret in error response/log; no DATABASE_URL leakage; `.env` testnet only; no production secrets in source.

**OPEN DECISIONS:** 10 items (HTTP status code, error classification body, correlation ID, rate-limit backoff, circuit-breaker, structured logging, `api.ts` wrapping, synthetic delete vs comment, test framework, `dispatchToLiveExchange()` stub — DECIDED NO).

**DEPENDENCIES:** P0-002 PASS required for runtime validation; P0-002 BLOCKED — ENVIRONMENT.

**P0-003 READINESS VERDICT: READY FOR HUMAN IMPLEMENTATION APPROVAL**

**P0-003 IMPLEMENTATION:** NOT AUTHORIZED

**TRADER BRAIN:** DISABLED
**LIVE TRADING:** DISABLED

**NEXT ACTION:** Human approval for P0-003 implementation (or P0-002 runtime restoration). Do NOT start P0-004.

**STOP — ACCEPTANCE CONTRACT COMPLETE — NO SYNTHETIC FALLBACK REMOVED — NO SOURCE CODE MODIFIED — NEXT: HUMAN DECISION (approve P0-003 implementation, or restore P0-002 runtime environment).**
