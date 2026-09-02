# P0-003 — IMPLEMENTATION AUDIT: SYNTHETIC/FALLBACK INVENTORY

**Date:** 2026-09-02
**Environment:** Native Windows 10 x64, Node v22.23.2, pnpm 9.15.0
**Profiles:** A — SQLite / development | B — PostgreSQL / production
**Status:** AUDIT COMPLETE / P0-003 READY WITH RESIDUAL ITEMS
**Scope:** Documentation-only audit against Doc 37 + Doc 25 + current source
**Accuracy note:** Section C current-state claims describe actual source behavior as of this audit. Target-state items in Section E are explicitly marked as NOT YET IMPLEMENTED.

---





## A. AUDIT OBJECTIVE

Determine exactly where synthetic/mock/fake trading data or fallback behavior still exists in the application, map each finding against P0-003 requirements, and identify the exact remaining work before P0-003 implementation can begin.

---





## B. SOURCE INSPECTION SUMMARY

### B.1 Files Inspected

| File | Production Path | Synthetic/Mock Finding | Classification |
|------|-----------------|------------------------|----------------|
| `server/services/binance.ts` | YES | Synthetic generators disabled; catch blocks re-throw | **ALREADY REMOVED** |
| `server/services/bybit.ts` | YES | Synthetic generators disabled; catch blocks re-throw | **ALREADY REMOVED** |
| `server/services/researchLab.ts` | Backtest only | `dummyOrderBook` placeholder | **TEST FIXTURE** |
| `server/services/multiAgentBrain.ts` | YES | `QUANTITATIVE_FALLBACK` mode enum | **NOT SYNTHETIC DATA** |
| `server/services/memoryLedger.ts` | YES | Seeded equity initialization | **NOT SYNTHETIC DATA** |
| `server/services/executionEngine.ts` | YES | None | **CLEAN** |
| `server/services/riskEngine.ts` | YES | None | **CLEAN** |
| `server/routes/api.ts` | YES | None | **CLEAN** |
| `src/types/trading.ts` | YES | `engineMode` type union | **NOT SYNTHETIC DATA** |

---





## C. PRODUCTION-PATH SYNTHETIC DATA INVENTORY

### Finding 1: binance.ts — Production-Path Synthetic Fallback REMOVED; Dead-Code Methods REMAIN

**Current production-path behavior (ACTUAL):**
- `getTicker()` catch block: re-throws original error; does NOT call `generateSyntheticTicker()`
- `getOrderBook()` catch block: re-throws original error; does NOT call `generateSyntheticOrderBook()`
- `getKlines()` catch block: re-throws original error; does NOT call `generateSyntheticCandles()`

**Dead-code methods still present:**
```typescript
private generateSyntheticTicker(symbol: string): never {
  throw new Error(`Synthetic fallback DISABLED (P0-003): getTicker failed for ${symbol}`);
}
private generateSyntheticOrderBook(symbol: string): never {
  throw new Error(`Synthetic fallback DISABLED (P0-003): getOrderBook failed for ${symbol}`);
}
private generateSyntheticCandles(symbol: string, count = 60): never {
  throw new Error(`Synthetic fallback DISABLED (P0-003): getKlines failed for ${symbol}`);
}
```

**Classification:** 
- Production-path fallback: **REMOVED** — catch blocks re-throw, no synthetic data returned to callers
- Synthetic generator methods: **DEAD CODE** — methods exist but always throw; not callable from production path

**What must be removed:** The three dead-code methods (`generateSyntheticTicker`, `generateSyntheticOrderBook`, `generateSyntheticCandles`).

**What must be preserved:** The error-throwing behavior in catch blocks.

**Dependencies/blockers:** None — safe removal.

**Required execution order:** Can be removed as part of P0-003 cleanup.

---

### Finding 2: bybit.ts — Production-Path Synthetic Fallback REMOVED; Dead-Code Methods REMAIN

**Current production-path behavior (ACTUAL):**
- `getTicker()` catch block: re-throws original error; does NOT call `generateSyntheticTicker()`
- `getOrderBook()` catch block: re-throws original error; does NOT call `generateSyntheticOrderBook()`
- `getKlines()` catch block: re-throws original error; does NOT call `generateSyntheticCandles()`

**Dead-code methods still present:**
```typescript
private generateSyntheticTicker(symbol: string): never {
  throw new Error(`Synthetic fallback DISABLED (P0-003): getTicker failed for ${symbol}`);
}
private generateSyntheticOrderBook(symbol: string): never {
  throw new Error(`Synthetic fallback DISABLED (P0-003): getOrderBook failed for ${symbol}`);
}
private generateSyntheticCandles(symbol: string, count = 60): never {
  throw new Error(`Synthetic fallback DISABLED (P0-003): getKlines failed for ${symbol}`);
}
```

**Classification:** 
- Production-path fallback: **REMOVED** — catch blocks re-throw, no synthetic data returned to callers
- Synthetic generator methods: **DEAD CODE** — methods exist but always throw; not callable from production path

**What must be removed:** The three dead-code methods.

**What must be preserved:** The error-throwing behavior in catch blocks.

**Dependencies/blockers:** None — safe removal.

**Required execution order:** Can be removed as part of P0-003 cleanup.

---





## D. TEST/DEVELOPMENT FIXTURES (NOT PRODUCTION PATH)

### Finding 3: researchLab.ts — dummyOrderBook Placeholder

**Location:** `server/services/researchLab.ts:93-101`

**Current state:**
```typescript
const dummyOrderBook = {
  symbol: req.symbol,
  exchange: req.exchange,
  bids: [],
  asks: [],
  imbalanceRatio: 1.0,
  timestamp: currentCandle.timestamp,
};
const regime = assessMarketRegime(windowCandles, indicators, dummyOrderBook, 0.0001);
```

**Classification:** TEST FIXTURE — used only in `runBacktest()` for historical candle replay where order book snapshots are not available.

**Production-critical path:** NO — backtest runs on historical candles, not live exchange data.

**What must be preserved:** The backtest capability. The `dummyOrderBook` can remain as a development fixture OR be replaced with a more explicit comment indicating it's a test-only placeholder.

**What must NOT happen:** This fixture must NOT leak into production market-data paths.

**Dependencies/blockers:** None for P0-003. This is outside P0-003 scope.

**Required execution order:** N/A — not part of P0-003.

---

### Finding 4: multiAgentBrain.ts — QUANTITATIVE_FALLBACK Mode

**Location:** `server/services/multiAgentBrain.ts:361`

**Current state:**
```typescript
engineMode: 'QUANTITATIVE_FALLBACK' as const,
```

**Classification:** ARCHITECTURAL MODE ENUM — deterministic numerical fallback, NOT synthetic trading data.

**Production-critical path:** NO — this is a mode selector for the multi-agent brain, not a data source.

**What must be preserved:** The mode enum. It's part of the approved architecture.

**Dependencies/blockers:** None.

**Required execution order:** N/A — not part of P0-003.

---

### Finding 5: memoryLedger.ts — Seeded Equity

**Location:** `server/services/memoryLedger.ts`

**Current state:** Initial equity seeded from `10000.0` to `10420.5` during initialization.

**Classification:** DEVELOPMENT SEED — not exchange data, not synthetic market data.

**Production-critical path:** NO — this is initial state for the memory ledger, not a data feed.

**What must be preserved:** The initialization pattern.

**Dependencies/blockers:** None.

**Required execution order:** N/A — not part of P0-003.

---





## E. WHAT P0-003 MUST IMPLEMENT

Per Doc 25 (TASK-P0-003) and Doc 37 (readiness audit), the following remains to be implemented:

### E.1 Environment Variable: USE_SYNTHETIC_DATA

**Status:** NOT IMPLEMENTED

**Requirement:** Add `USE_SYNTHETIC_DATA` env var, default FALSE.

**Behavior:**
- FALSE (default): production path — errors thrown on fetch failure, no synthetic data
- TRUE: development path — explicit synthetic data with visible banner

**Implementation boundary:**
- `binance.ts` and `bybit.ts` already throw on failure
- Need to add conditional synthetic generators behind `USE_SYNTHETIC_DATA=true` flag
- Synthetic generators should be re-implemented with explicit flag check

### E.2 Data Quality Logging

**Status:** PARTIALLY IMPLEMENTED

**Current state:** Errors are thrown but not logged to database.

**Requirement:** When `USE_SYNTHETIC_DATA=false` and fetch fails → log to `data_quality_log` DB table.

**Schema status:** `data_quality_log` table does NOT exist in current Prisma schema.

**Options:**
1. Add `data_quality_log` table to `schema-sqlite.prisma` and `schema.prisma`
2. Reuse existing `system_events` table with `event_type = 'DATA_QUALITY'`

**Recommended:** Option 2 — reuse `system_events` table to avoid schema changes in P0-003.

### E.3 Data Quality Endpoint

**Status:** NOT IMPLEMENTED

**Requirement:** Add `/api/data-quality` endpoint returning:
- Live data freshness
- Source (EXCHANGE vs SYNTHETIC)
- Latency

**Implementation boundary:**
- New route in `server/routes/api.ts`
- Reads from `system_events` table for data quality logs
- Returns current fetch status per exchange/symbol

### E.4 Frontend Synthetic Mode Banner

**Status:** NOT IMPLEMENTED

**Requirement:** Frontend shows visible banner when synthetic mode active.

**Implementation boundary:**
- New component in `src/components/`
- Reads `USE_SYNTHETIC_DATA` from environment/config
- Visible banner in `App.tsx`

---





## F. SYNTHETIC DATA SOURCE MAP

| Source | File | Path | Type | Production-Critical | Status |
|--------|------|------|------|---------------------|--------|
| Binance synthetic ticker | `binance.ts:151` | `generateSyntheticTicker()` | Dead code | NO | Disabled |
| Binance synthetic orderbook | `binance.ts:155` | `generateSyntheticOrderBook()` | Dead code | NO | Disabled |
| Binance synthetic candles | `binance.ts:159` | `generateSyntheticCandles()` | Dead code | NO | Disabled |
| Bybit synthetic ticker | `bybit.ts:143` | `generateSyntheticTicker()` | Dead code | NO | Disabled |
| Bybit synthetic orderbook | `bybit.ts:147` | `generateSyntheticOrderBook()` | Dead code | NO | Disabled |
| Bybit synthetic candles | `bybit.ts:151` | `generateSyntheticCandles()` | Dead code | NO | Disabled |
| ResearchLab dummyOrderBook | `researchLab.ts:93` | `runBacktest()` | Test fixture | NO | Test-only |
| QUANTITATIVE_FALLBACK mode | `multiAgentBrain.ts:361` | engineMode enum | Architectural | NO | Preserve |
| Memory ledger seed | `memoryLedger.ts` | initialization | Development seed | NO | Preserve |

---





## G. FALLBACK PATH MAP

| Path | Current Behavior | P0-003 Target Behavior |
|------|------------------|------------------------|
| Binance getTicker catch | Re-throws original error | Re-throws + log to DB if `USE_SYNTHETIC_DATA=false` |
| Binance getOrderBook catch | Re-throws original error | Re-throws + log to DB if `USE_SYNTHETIC_DATA=false` |
| Binance getKlines catch | Re-throws original error | Re-throws + log to DB if `USE_SYNTHETIC_DATA=false` |
| Bybit getTicker catch | Re-throws original error | Re-throws + log to DB if `USE_SYNTHETIC_DATA=false` |
| Bybit getOrderBook catch | Re-throws original error | Re-throws + log to DB if `USE_SYNTHETIC_DATA=false` |
| Bybit getKlines catch | Re-throws original error | Re-throws + log to DB if `USE_SYNTHETIC_DATA=false` |
| USE_SYNTHETIC_DATA=true | Not implemented | Return synthetic data with explicit flag |

---





## H. DEPENDENCIES AND BLOCKERS

| Dependency | Status | Impact |
|------------|--------|--------|
| ADR-001 (Language) | APPROVED | P0-003 uses TypeScript |
| ADR-002 (Database) | COMPLETE | `system_events` table available for data quality logs |
| Profile A SQLite | COMPLETE | Ready for development |
| Profile B PostgreSQL | COMPLETE | Ready for production |
| `USE_SYNTHETIC_DATA` env var | NOT IMPLEMENTED | Blocker for P0-003 |
| Data quality logging | PARTIALLY IMPLEMENTED | Needs DB logging in catch blocks |
| `/api/data-quality` endpoint | NOT IMPLEMENTED | Blocker for P0-003 |
| Frontend banner | NOT IMPLEMENTED | Blocker for P0-003 acceptance |

**External dependencies:** None. P0-003 is self-contained.

---





## I. REQUIRED EXECUTION ORDER

1. **Dead code removal** — Remove disabled synthetic generators from `binance.ts` and `bybit.ts`
2. **Environment variable** — Add `USE_SYNTHETIC_DATA` support to exchange services
3. **Data quality logging** — Add logging to `system_events` table in catch blocks
4. **API endpoint** — Add `/api/data-quality` route
5. **Frontend banner** — Add synthetic mode banner component
6. **Verification** — Run acceptance tests per Doc 25

---





## J. ACCEPTANCE CRITERIA

From Doc 25:

| Criterion | Current State | Target State |
|-----------|---------------|--------------|
| Normal operation: zero synthetic data | PASS — synthetic generators disabled | Maintain |
| Dev mode: synthetic data with explicit UI banner | FAIL — no env var, no banner | Implement |
| Network failure: error visible in logs/UI | PARTIAL — errors thrown but not logged to DB | Add DB logging |
| `/api/data-quality` returns correct source | FAIL — endpoint not implemented | Implement |
| No synthetic data in production logs/DB | PASS — synthetic generators disabled | Maintain |

---





## K. P0-003 GO/NO-GO

**P0-003 READINESS: GO with reservations**

**GO reasons:**
- Production-path synthetic fallback already removed from `binance.ts` and `bybit.ts`
- Exchange services now fail explicitly on fetch errors
- Database schema supports data quality logging via `system_events`
- No external blockers

**Reservations:**
- Dead code cleanup still required
- `USE_SYNTHETIC_DATA` env var not yet implemented
- Data quality endpoint not yet implemented
- Frontend banner not yet implemented
- `dummyOrderBook` in researchLab.ts needs documentation/cleanup decision

---





## L. EXACT NEXT AUTHORIZED ACTION

Explicit authorization to execute **P0-003 implementation** in the following order:

1. Remove dead synthetic generator methods from `binance.ts` and `bybit.ts`
2. Add `USE_SYNTHETIC_DATA` environment variable support
3. Add data quality logging to `system_events` table in exchange service catch blocks
4. Add `/api/data-quality` endpoint
5. Add frontend synthetic mode banner
6. Verify acceptance criteria from Doc 25

**STOP.** This is an audit document only. No implementation has been performed.
