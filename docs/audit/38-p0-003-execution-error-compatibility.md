# P0-003 Execution-Engine Error Handling Compatibility — Read-Only Audit

**Status:** COMPATIBLE — P0-003 CAN REMOVE FALLBACK WITHOUT ENGINE CHANGE (with verification note)
**Task:** P0-003 Execution-Engine Compatibility Review (read-only)
**Role:** Principal Engineer ONLY | Trader Brain DISABLED | Live Trading DISABLED
**P0-002:** BLOCKED — ENVIRONMENT
**Date:** 2026-08-31

---

## Verdict (final, 20 lines)

**COMPATIBLE — P0-003 CAN REMOVE SYNTHETIC FALLBACK WITHOUT EXECUTION ENGINE CHANGE**, subject to verification of `executionEngine.executeApprovedTrade` error propagation (already read-only verified safe — engine does not invoke exchange REST clients directly; `dispatchToLiveExchange` is stub). `api.ts` (market-data router) will receive thrown errors instead of synthetic `MarketTicker`; this is SAFE — synthetic data removal must not suppress errors.

---

## Source files inspected (read-only)

- `server/services/executionEngine.ts` (303 lines)
- `server/services/binance.ts` (232 lines, lines 67, 118, catch blocks)
- `server/services/bybit.ts` (224 lines, identical pattern)
- `server/routes/api.ts` (line 38-43 — `service.getTicker` call, no try/catch)
- `src/types/trading.ts` (types only — `MarketTicker`, `Order`, `Position`)

No source modified. `git status`: `docs/` untracked only; `server/`/`src/` clean.

---

## 1. Call graph from executionEngine.ts → exchange

- `executionEngine.executeApprovedTrade()` (`line 62`) — takes `ticker: MarketTicker` (passed IN, never fetched from exchange)
- `executionEngine.dispatchToLiveExchange()` (`line 297`) — stub (`console.log` only); does NOT call `binanceService.getTicker()` or `bybitService.getTicker()`
- **Direct exchange-service invocation from executionEngine.ts: ZERO.**

Therefore P0-003 (removing `generateSyntheticTicker()` from `binance.ts`/`bybit.ts`) has **no impact** on `executionEngine.ts` error paths — engine never reaches the synthetic fallback path.

---

## 2. Exchange-service call sites (api.ts — market-data router)

`api.ts` line 38-43:
```ts
const service = exchange === 'bybit' ? bybitService : binanceService;
await Promise.all([service.getTicker(symbol), service.getOrderBook(symbol,20), service.getKlines(...)])
```
No `try/catch` around `Promise.all`. If `getTicker()` throws (after P0-003 removes synthetic fallback), error propagates to `api.ts` caller. **This is safe — no silent synthetic substitution.**

---

## 3. Synthetic fallback interaction (pre-P0-003 vs post-P0-003)

| Scenario | Pre-P0-003 (`catch` → synthetic) | Post-P0-003 (`catch` → throw) | Impact on engine |
|---|---|---|---|
| REST timeout | Returns `MarketTicker` with hardcoded price 65000 | Throws Error | Engine never sees ticker (passed in externally); safe |
| REST 500 | Returns synthetic order book | Throws Error | `api.ts` fails visibly; safe |
| Network down | Returns synthetic candles | Throws Error | No silent fake data; safe |

---

## 4. Failure-mode analysis

- **Exception thrown?** Yes — P0-003 must replace `return synthetic` with `throw new Error(...)`.
- **Rejection unhandled?** In `api.ts` — yes, but VISIBLY (no synthetic data hidden). Post-P0-003 requires either explicit error handler or documented failure mode.
- **Silent failure?** Pre-P0-003: YES (synthetic data looks real). Post-P0-003: NO (throw makes failure explicit).
- **Process crash?** Unlikely — `api.ts` is Express route; unhandled `Promise.all` rejection will result in HTTP 500 (visible), not process crash.
- **Incorrect order/position?** No — engine uses `ticker` passed in; does not pull from exchange service directly.

---

## 5. Source-of-truth implications

P0-003 preserves source-of-truth model (from ADR-002 / 31):
- DB authoritative: submitted orders, risk decisions (immunity preserved)
- Exchange authoritative: fills (not affected; P0-003 only affects market-data REST calls)
- No synthetic data translates to: no false `MarketTicker` observation; reconciliation (P0-004) will work on real data only.

---

## 6. Idempotency implications

No impact.
- `client_order_id` idempotency is in `prisma/schema.prisma` (DB layer)
- `executionEngine.executeApprovedTrade()` creates `order.id = ord_...` (new order) — no retry/reconciliation in engine
- P0-003 does not change order-id behavior

---

## 7. Compatibility verdict

**COMPATIBLE** — P0-003 synthetic-fallback removal does NOT require `executionEngine.ts` change.

**Caution:** If future P0-004 (ExchangeAdapter) integrates `binanceService.getTicker()` directly into execution flow, then error propagation must be explicitly designed (out of scope here — P0-003 is compatibility audit only).

---

**STOP. Source unchanged. No synthetic fallback removed. Next: human approval for P0-003 implementation or P0-002 runtime restoration.**
