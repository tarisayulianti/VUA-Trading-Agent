# MASTER WORK BREAKDOWN

Root inspected: /root/projects/VUA-Trading-Agent (read-only audit).
Derived from: 20-blueprint-reconciliation.md, 21-roadmap-reconciliation.md, 22-architecture-decisions.md, 23-master-gap-list.md.
Every task is executable. No vague descriptions. No implementation until human approval of this reconciliation.

---

## P0 BLOCKING TASKS (Must complete in dependency order)

---

### TASK-P0-001: Architecture Decision — Core Language & Stack

| Field | Value |
|-------|-------|
| TASK ID | TASK-P0-001 |
| TASK NAME | Architecture Decision — Core Language & Stack |
| OBJECTIVE | Resolve TypeScript vs Python conflict via ADR-001 human approval. |
| WHY | All downstream tasks depend on runtime choice. ORM, CI/CD, deployment, exchange adapters all vary by language. Cannot build anything real without this decision. |
| DEPENDENCIES | None (root decision) |
| AFFECTED COMPONENTS | All server/services/*.ts; package.json; potential new Python backend directory |
| IMPLEMENTATION REQUIREMENTS | Human reviews ADR-001; selects Option A (Keep TS), B (Migrate to Python), or C (Hybrid). Decision recorded in ADR log. |
| TEST REQUIREMENTS | N/A — decision only |
| SECURITY REQUIREMENTS | N/A |
| OBSERVABILITY REQUIREMENTS | ADR decision document updated with APPROVED/REJECTED status + timestamp |
| ACCEPTANCE CRITERIA | One of three options explicitly approved. No ambiguous state. |
| DEFINITION OF DONE | Human writes "APPROVED: [Option A/B/C]" in ADR-001. Document signed with date. |
| BLOCKING STATUS | BLOCKING — all other P0 tasks depend on this |

---

### TASK-P0-002: Database Initialization — PostgreSQL Schema

| Field | Value |
|-------|-------|
| TASK ID | TASK-P0-002 |
| TASK NAME | Initialize PostgreSQL with Blueprint DDL Schema |
| OBJECTIVE | Replace in-memory state with durable PostgreSQL. Implement 10 blueprint tables plus event log. |
| WHY | Zero persistence = all trading history, positions, orders, risk decisions vanish on restart. No reconciliation possible. No backtesting validity. |
| DEPENDENCIES | TASK-P0-001 (language decision determines ORM choice) |
| AFFECTED COMPONENTS | New `db/` directory; migration files; ORM setup; all services needing state |
| IMPLEMENTATION REQUIREMENTS | Create PostgreSQL schema per blueprint DDL: `market_events`, `signals`, `orders`, `positions`, `risk_decisions`, `trades`, `accounts`, `config_history`, `audit_log`, `epistemic_events`. Add append-only event log table. Prisma (if TS) or SQLAlchemy+Alembic (if Python). |
| TEST REQUIREMENTS | Migrations run successfully; all tables created; foreign keys enforced; indexes on timestamp columns |
| SECURITY REQUIREMENTS | DB user with minimal privileges (no DROP); SSL connections; no plaintext passwords in repo |
| OBSERVABILITY REQUIREMENTS | Migration status in startup logs; health check endpoint verifies DB connectivity |
| ACCEPTANCE CRITERIA | `psql` confirms all 10+ tables exist. DB survives restart. Application connects automatically. |
| DEFINITION OF DONE | `docker-compose up` creates DB + runs migrations. App connects without manual steps. No data loss on restart. |
| BLOCKING STATUS | BLOCKING — GAP-002, GAP-005, GAP-101, GAP-104, GAP-106, GAP-107 all blocked by this |

---

### TASK-P0-003: Data Foundation — Replace Synthetic Fallback with Explicit Mode Flag

| Field | Value |
|-------|-------|
| TASK ID | TASK-P0-003 |
| TASK NAME | Data Foundation — Replace Synthetic Fallback with Explicit Mode Flag |
| OBJECTIVE | Remove hidden synthetic fallback from binance.ts and bybit.ts. Replace with explicit `USE_SYNTHETIC_DATA=true` flag that is ONLY respected in development. Production must fail visibly if real data unavailable. |
| WHY | Synthetic fallback in production path masks every failure. System reports "working" while using fake data. No way to know if live feeds are down. |
| DEPENDENCIES | TASK-P0-001, TASK-P0-002 (DB for data quality logging) |
| AFFECTED COMPONENTS | binance.ts, bybit.ts, api.ts (perception loop) |
| IMPLEMENTATION REQUIREMENTS | (1) Remove silent synthetic fallback in production path. (2) Add `USE_SYNTHETIC_DATA` env var, default FALSE. (3) When FALSE and fetch fails → throw error, log to `data_quality_log` DB table. (4) Add `/api/data-quality` endpoint returning live data freshness, source (EXCHANGE vs SYNTHETIC), and latency. (5) Frontend shows visible banner when synthetic mode active. |
| TEST REQUIREMENTS | Network offline → error thrown (not synthetic returned). `USE_SYNTHETIC_DATA=true` → synthetic data returned with explicit flag. `/api/data-quality` returns correct source. |
| SECURITY REQUIREMENTS | No synthetic data in production logs or DB unless explicitly flagged |
| OBSERVABILITY REQUIREMENTS | Every data fetch logged with source, latency, freshness. Data quality dashboard in UI. |
| ACCEPTANCE CRITERIA | Normal operation: zero synthetic data. Dev mode: synthetic data with explicit UI banner. Network failure: error visible in logs/UI, not silently masked. |
| DEFINITION OF DONE | Production deployment shows no synthetic data. Dev mode shows banner. Data quality endpoint returns accurate source. |
| BLOCKING STATUS | BLOCKING — GAP-003, GAP-006, GAP-101, GAP-105 all depend on real data foundation |

---

### TASK-P0-004: Exchange Adapter — WebSocket + Reconciliation Framework

| Field | Value |
|-------|-------|
| TASK ID | TASK-P0-004 |
| TASK NAME | Exchange Adapter — WebSocket Real-Time Feeds + Reconciliation Framework |
| OBJECTIVE | Replace REST polling with WebSocket streaming. Implement order and position reconciliation engine comparing local state against exchange state. |
| WHY | REST polling every 3s is too slow for execution. No reconciliation means local positions can diverge from exchange silently. Cannot do safe live trading. |
| DEPENDENCIES | TASK-P0-001, TASK-P0-002, TASK-P0-003 |
| AFFECTED COMPONENTS | New `server/services/exchange-adapter.ts` interface; new `server/services/reconciliation-engine.ts`; binance.ts; bybit.ts; executionEngine.ts |
| IMPLEMENTATION REQUIREMENTS | (1) Define `ExchangeAdapter` interface: `subscribe(symbol, callback)`, `getOrderBook()`, `getPositions()`, `placeOrder()`, `cancelOrder()`. (2) Implement BinanceWebSocketAdapter and BybitWebSocketAdapter implementing interface. (3) Implement ReconciliationEngine: runs every tick, compares local positions/orders vs exchange state, logs discrepancies to DB. (4) Auto-reconnect with exponential backoff. (5) REST remains as fallback with explicit flag. |
| TEST REQUIREMENTS | WebSocket connects to testnet. Order placed via adapter. Reconciliation detects and logs mismatch. Reconnection after disconnect tested. |
| SECURITY REQUIREMENTS | HMAC-SHA256 signing for authenticated endpoints. Keys never logged. Testnet only for initial validation. |
| OBSERVABILITY REQUIREMENTS | Connection state in UI. Reconciliation status endpoint. Disconnect logged immediately. |
| ACCEPTANCE CRITERIA | WebSocket connects to testnet within 5s. Reconciliation runs every tick. Mismatches logged with full context. Auto-reconnect works. |
| DEFINITION OF DONE | Testnet orders reconciled. Local state matches exchange state within 1 tick. No silent divergence. |
| BLOCKING STATUS | BLOCKING — GAP-004, GAP-008, GAP-101, ADR-003, ADR-004, ADR-008 all blocked by this |

---

### TASK-P0-005: Risk Engine — Durable Persistence + Audit Trail

| Field | Value |
|-------|-------|
| TASK ID | TASK-P0-005 |
| TASK NAME | Risk Engine — Durable Persistence + Audit Trail |
| OBJECTIVE | Make risk configuration durable and all veto decisions auditable. Every trade rejection logged with full context. |
| WHY | Risk decisions in memory only = no audit trail, no accountability, config lost on restart. Must be able to prove why every trade was rejected. |
| DEPENDENCIES | TASK-P0-002 (DB schema), TASK-P0-004 (execution path) |
| AFFECTED COMPONENTS | riskEngine.ts, memoryLedger.ts, new `risk_decisions` DB table |
| IMPLEMENTATION REQUIREMENTS | (1) Move risk config to `risk_config` DB table. Load on startup. Validate on update. (2) Log every `evaluateTradeRisk()` call to `risk_decisions` table: hypothesis ID, equity, drawdown, checks passed/failed, veto reason, timestamp, engine mode. (3) Add `GET /api/risk/decisions?limit=100` endpoint for audit. (4) Config changes logged to `config_history` table. (5) Read-only audit log: config changes never deleted. |
| TEST REQUIREMENTS | 100% of veto scenarios produce DB record. Config survives restart. Audit log queryable. Config change history complete. |
| SECURITY REQUIREMENTS | Audit log is append-only. No delete/update on audit records. |
| OBSERVABILITY REQUIREMENTS | Dashboard showing veto rate, top veto reasons, risk config change history. |
| ACCEPTANCE CRITERIA | Every risk veto has DB record with full context. Config persists across restarts. Audit endpoint returns complete history. |
| DEFINITION OF DONE | 100% of evaluateTradeRisk calls produce audit record. Zero veto events lost. Audit log queryable. |
| BLOCKING STATUS | BLOCKING — GAP-005, GAP-104, GAP-106 all depend on this |

---

### TASK-P0-006: Backtesting Engine — Historical Data + Deterministic Replay

| Field | Value |
|-------|-------|
| TASK ID | TASK-P0-006 |
| TASK NAME | Backtesting Engine — Historical Data + Deterministic Replay |
| OBJECTIVE | Replace synthetic candle backtesting with real historical data replay. Backtests must be deterministic and reproducible. |
| WHY | Current backtesting on synthetic candles cannot validate strategy. Results are meaningless for real trading decisions. |
| DEPENDENCIES | TASK-P0-002 (historical candle store), TASK-P0-003 (real data foundation), TASK-P0-005 (risk audit) |
| AFFECTED COMPONENTS | researchLab.ts, new `server/services/backtest-engine.ts`, new `server/services/historical-data-service.ts` |
| IMPLEMENTATION REQUIREMENTS | (1) Historical candle hypertable in PostgreSQL (TimescaleDB preferred). Backfill 1+ years BTC/USDT 15m. (2) BacktestEngine: deterministic replay, seed RNG with candle timestamp, every run produces identical results for same candle set. (3) OOS validation: train on 70% candles, test on 30%. Report in-sample vs out-of-sample discrepancy. (4) Walk-forward analysis: rolling window. (5) Connect to risk engine for veto decisions during replay. Log every veto in same `risk_decisions` table. |
| TEST REQUIREMENTS | Same candle set + same strategy = identical results across runs. OOS validation implemented. Walk-forward runs without error. |
| SECURITY REQUIREMENTS | No live trading from backtest engine. Read-only on historical data. |
| OBSERVABILITY REQUIREMENTS | Backtest results stored in DB. Full trade log queryable. Regime breakdown per backtest. |
| ACCEPTANCE CRITERIA | Backtest on real historical data completes. OOS validation shows realistic edge estimate. Results reproducible across runs. |
| DEFINITION OF DONE | Backtest runs on 1 year of real 15m candles. OOS win rate within 10% of IS win rate. Zero non-deterministic behavior. |
| BLOCKING STATUS | BLOCKING — GAP-006, GAP-201, GAP-202, GAP-203 all depend on this |

---

### TASK-P0-007: Health Gates — CI/CD Enforcement Pipeline

| Field | Value |
|-------|-------|
| TASK ID | TASK-P0-007 |
| TASK NAME | Health Gates — CI/CD Enforcement Pipeline |
| OBJECTIVE | Enforce Gates 0-12 in CI/CD. Each gate requires evidence artifact before next stage unlocks. No bypass. |
| WHY | Health gates defined in documentation only = no actual enforcement. Gates can be skipped. System can reach "production" without proper validation. |
| DEPENDENCIES | TASK-P0-001 through TASK-P0-006 (all gate evidence depends on completed systems) |
| AFFECTED COMPONENTS | `.github/workflows/ci.yml`, new `docs/audit/gate-evidence/` directory, new gate-check script |
| IMPLEMENTATION REQUIREMENTS | (1) Create GitHub Actions pipeline with gate stages: `gate-0-understood`, `gate-1-architecture`, `gate-2-core-functional`, `gate-3-testing`, `gate-4-risk-boundary`, `gate-5-exchange-integration`, `gate-6-backtest`, `gate-7-paper`, `gate-8-operational`, `gate-9-micro-live`, `gate-10-production-candidate`, `gate-11-final-audit`, `gate-12-go-no-go`. (2) Each stage requires evidence files in `docs/audit/gate-evidence/gate-N-*.md`. (3) Gate evidence templates provided: entry criteria, exit criteria, evidence checklist, approval signature field. (4) PR cannot merge to main without passing current gate stage. |
| TEST REQUIREMENTS | Pipeline runs on every PR. Stage-gate blocks merged when evidence missing. Gate evidence template populates correctly. |
| SECURITY REQUIREMENTS | Pipeline credentials via GitHub secrets. No hardcoded keys. |
| OBSERVABILITY REQUIREMENTS | Pipeline status visible in GitHub UI. Gate evidence in repo. Audit trail in git history. |
| ACCEPTANCE CRITERIA | Pipeline enforces gate order. Gate N+1 blocked until gate N evidence exists. Zero bypass paths. |
| DEFINITION OF DONE | Every gate has evidence template. Pipeline passes all stages. No merge to main without gate evidence. |
| BLOCKING STATUS | BLOCKING — GAP-007, ALL operational and production tasks blocked by this |

---

## P1 NON-BLOCKING TASKS (Can begin after P0 tasks start)

---

### TASK-P1-101: Reconciliation Engine — Production Validation

| Field | Value |
|-------|-------|
| TASK ID | TASK-P1-101 |
| TASK NAME | Reconciliation Engine — Production Validation |
| OBJECTIVE | Validate reconciliation engine under real testnet conditions. Document divergence patterns and resolution procedures. |
| WHY | Reconciliation engine exists but never validated under real conditions. Unknown behavior under network partition, exchange maintenance, high-volatility fills. |
| DEPENDENCIES | TASK-P0-004 (exchange adapter) |
| AFFECTED COMPONENTS | `server/services/reconciliation-engine.ts`, executionEngine.ts |
| IMPLEMENTATION REQUIREMENTS | (1) Stress test reconciliation: network partition simulation, exchange maintenance window, high-volatility price spike. (2) Document all divergence patterns: causes, detection time, resolution action. (3) Auto-resolution for recoverable divergences (reconnect, re-fetch). (4) Manual escalation for unrecoverable divergences (kill switch). |
| TEST REQUIREMENTS | Reconciliation detects 100% of injected mismatches. Auto-resolution succeeds for recoverable cases. Manual escalation triggered for unrecoverable. |
| SECURITY REQUIREMENTS | Kill switch always available during reconciliation stress test |
| OBSERVABILITY REQUIREMENTS | Reconciliation divergence events logged with full context. Dashboard shows reconciliation health. |
| ACCEPTANCE CRITERIA | All divergence patterns documented. Auto-resolution covers 90%+ of recoverable cases. Zero silent divergences. |
| DEFINITION OF DONE | Reconciliation validated under 5+ stress scenarios. Documentation complete. |

---

### TASK-P1-102: Secret Management — Vault + Rotation

| Field | Value |
|-------|-------|
| TASK ID | TASK-P1-102 |
| TASK NAME | Secret Management — Vault + Rotation |
| OBJECTIVE | Replace in-memory key storage with vault-backed secret management. API key rotation without downtime. Full audit log. |
| WHY | API keys in memory + no rotation = security risk. Keys cannot be rotated without server restart. No audit trail of key usage. |
| DEPENDENCIES | TASK-P0-002 (DB), TASK-P0-004 (exchange adapter) |
| AFFECTED COMPONENTS | executionEngine.ts, credentials endpoint, new secret-manager service |
| IMPLEMENTATION REQUIREMENTS | (1) Integrate HashiCorp Vault or AWS Secrets Manager. (2) Keys stored in vault, never in code or memory dump. (3) Read key from vault at runtime. (4) Rotation: new key added to vault, old key deprecated, zero-downtime cutover. (5) Audit log: every key access logged with timestamp, user, purpose. |
| TEST REQUIREMENTS | Key rotation tested without service restart. Vault unavailable → graceful degradation (refuse live trading). Audit log contains every key access. |
| SECURITY REQUIREMENTS | Zero plaintext keys in logs or memory dumps. Vault access requires mTLS. Keys rotated every 90 days minimum. |
| OBSERVABILITY REQUIREMENTS | Key age visible in UI. Rotation events in audit log. Vault health in monitoring. |
| ACCEPTANCE CRITERIA | Key rotation tested end-to-end. Audit log complete. Vault failure prevents live trading. |
| DEFINITION OF DONE | Rotation tested. Audit log queryable. Zero plaintext keys in system. |

---

### TASK-P1-103: Risk Engine — Comprehensive Test Suite

| Field | Value |
|-------|-------|
| TASK ID | TASK-P1-103 |
| TASK NAME | Risk Engine — Comprehensive Unit + Integration Tests |
| OBJECTIVE | 100% coverage on every veto condition. Edge cases tested: extreme equity, concurrent positions, circuit breaker at boundary, kill switch during execution. |
| WHY | Risk engine is the capital preservation backbone. A bug here = potential unlimited losses. Current code has zero tests. |
| DEPENDENCIES | TASK-P0-002 (DB for integration tests) |
| AFFECTED COMPONENTS | riskEngine.ts, new `__tests__/riskEngine.test.ts` |
| IMPLEMENTATION REQUIREMENTS | (1) Unit tests: every veto condition in evaluateTradeRisk() tested in isolation. (2) Edge cases: equity = 0, drawdown = maxDailyDrawdown (boundary), kill switch during trade, max positions, duplicate symbol. (3) Integration tests: risk engine + execution engine. (4) Property-based tests: random equity, position count, verify veto logic consistent. (5) Test that approved=false when ANY check fails. |
| TEST REQUIREMENTS | 100% branch coverage on riskEngine.ts. All 8 veto conditions tested. Edge cases at boundary values. |
| SECURITY REQUIREMENTS | Tests cannot bypass risk checks. Test credentials isolated from production. |
| OBSERVABILITY REQUIREMENTS | Coverage report generated. Failures fail CI. |
| ACCEPTANCE CRITERIA | 100% branch coverage. All veto conditions produce expected result. Zero false approvals. |
| DEFINITION OF DONE | Coverage report shows 100% branch coverage. CI passes. All edge cases pass. |

---

### TASK-P1-104: Multi-Agent Debate — Persistent Audit Log

| Field | Value |
|-------|-------|
| TASK ID | TASK-P1-104 |
| TASK NAME | Multi-Agent Debate — Persistent Audit Log |
| OBJECTIVE | Every multi-agent deliberation logged to DB. Full trace: inputs, agent verdicts, synthesis, confidence scores, final decision. Queryable for learning. |
| WHY | Debates currently in memory + SSE only. Lost on restart. Cannot learn from deliberation patterns. No accountability for agent decisions. |
| DEPENDENCIES | TASK-P0-002 (DB), TASK-P0-005 (risk audit), TASK-P0-006 (backtest) |
| AFFECTED COMPONENTS | multiAgentBrain.ts, api.ts, new `debates` DB table |
| IMPLEMENTATION REQUIREMENTS | (1) `debates` table: id, snapshot_hash, regime, agent_verdicts (JSON), synthesis, final_verdict, confidence, engine_mode, timestamp. (2) Log every deliberation to DB before returning. (3) Link debates to subsequent trades (hypothesis_id). (4) `GET /api/debates?limit=100` endpoint. (5) Backtest engine reads debate history for learning. |
| TEST REQUIREMENTS | Every deliberation produces DB record. Linked to subsequent trade. Query endpoint returns correct data. |
| OBSERVABILITY REQUIREMENTS | Debate volume dashboard. Engine mode distribution. Average confidence per regime. |
| ACCEPTANCE CRITERIA | Every deliberation logged. Linked to trades. Queryable. Used in backtest learning. |
| DEFINITION OF DONE | Debate log queryable. Full deliberation trace on every trade. |

---

### TASK-P1-105: Position Sizing — Independent Validation Service

| Field | Value |
|-------|-------|
| TASK ID | TASK-P1-105 |
| TASK NAME | Position Sizing — Independent Validation Service |
| OBJECTIVE | Independent, cross-validated Kelly sizing calculation. Verify risk engine sizing against independent implementation. |
| WHY | Single path for sizing = single point of failure. No way to detect if sizing calculation has a bug. |
| DEPENDENCIES | TASK-P1-103 (tests), TASK-P0-002 (DB) |
| AFFECTED COMPONENTS | riskEngine.ts, new `server/services/sizing-validator.ts` |
| IMPLEMENTATION REQUIREMENTS | (1) Extract sizing formula to separate `PositionSizingService`. (2) Implement second independent calculation (different code path). (3) Compare outputs. Divergence > 0.1% triggers alert and veto. (4) Cross-validated result used for execution. |
| TEST REQUIREMENTS | Independent calculation produces identical results for same inputs. Divergence detection works. |
| SECURITY REQUIREMENTS | Both calculations must agree before execution. |
| OBSERVABILITY REQUIREMENTS | Sizing divergence logged. Alert on >0.1% divergence. |
| ACCEPTANCE CRITERIA | Both calculations agree within tolerance. Divergence detected and vetoed. |
| DEFINITION OF DONE | Independent validator implemented. Divergence test passes. |

---

### TASK-P1-106: Funding Rate — Integration into Risk Sizing

| Field | Value |
|-------|-------|
| TASK ID | TASK-P1-106 |
| TASK NAME | Funding Rate — Integration into Risk Sizing |
| OBJECTIVE | Funding rate used in position sizing and veto logic. Long entries blocked when funding > threshold. |
| WHY | Currently funding rate only used in regime assessment. Extreme funding makes long positions structurally expensive. Not reflected in risk sizing. |
| DEPENDENCIES | TASK-P0-004 (real data), TASK-P1-103 (risk tests) |
| AFFECTED COMPONENTS | riskEngine.ts, regime.ts, multiAgentBrain.ts |
| IMPLEMENTATION REQUIREMENTS | (1) Add funding rate to RiskCheckResult. (2) Veto long entries when 24h funding rate > +0.035% (configurable). (3) Adjust position size for funding cost over expected holding period. (4) Log funding rate decision in risk audit. |
| TEST REQUIREMENTS | Veto fires when funding > threshold. Position size adjusted. Threshold configurable. |
| OBSERVABILITY REQUIREMENTS | Funding rate shown in risk check result. Veto reason includes funding. |
| ACCEPTANCE CRITERIA | Long blocked when funding > threshold. Size adjusted for funding cost. Configurable threshold. |
| DEFINITION OF DONE | Funding veto tested. Size adjustment verified. |

---

### TASK-P1-107: Order Book Depth — Full Depth + Quality Score

| Field | Value |
|-------|-------|
| TASK ID | TASK-P1-107 |
| TASK NAME | Order Book Depth — Full Depth + Quality Score |
| OBJECTIVE | Fetch 100+ order book levels. Compute liquidity quality score. Reject trades in thin markets. |
| WHY | Current 20-25 levels insufficient for liquidity assessment. Cannot detect thin markets before execution. |
| DEPENDENCIES | TASK-P0-004 (WebSocket), TASK-P1-103 (risk tests) |
| AFFECTED COMPONENTS | binance.ts, bybit.ts, indicators.ts, riskEngine.ts |
| IMPLEMENTATION REQUIREMENTS | (1) Fetch 100 levels per side (configurable). (2) Compute `LiquidityQualityScore`: depth (total notional), spread ratio, level concentration (Herfindahl index), imbalance. (3) Pass score to risk engine. (4) Veto if score below threshold (configurable). (5) Log quality score in data quality log. |
| TEST REQUIREMENTS | Quality score computed correctly. Veto fires on thin market. Threshold configurable. |
| OBSERVABILITY REQUIREMENTS | Quality score in UI. Historical quality per symbol. |
| ACCEPTANCE CRITERIA | 100+ levels fetched. Quality score computed. Thin markets vetoed. |
| DEFINITION OF DONE | Full depth fetched. Score computed. Veto works. |

---

## P2 TASKS (Important, non-blocking)

| TASK ID | TASK NAME | WHY | DEPENDENCIES |
|---------|-----------|------|--------------|
| TASK-P2-201 | Historical Data Store — TimescaleDB Backfill | Valid backtesting requires real historical data | TASK-P0-002, TASK-P0-004 |
| TASK-P2-202 | Strategy Framework — Pluggable Interface | Hardcoded strategies prevent strategy experimentation | TASK-P0-006, TASK-P1-104 |
| TASK-P2-203 | Portfolio — Multi-Symbol Capital Allocation | Single symbol limits real-world utility | TASK-P0-002, TASK-P0-004 |
| TASK-P2-204 | Alerting — Telegram/Email/Slack | No notification for critical events | TASK-P0-007 |
| TASK-P2-205 | Configuration — Declarative YAML/JSON | Hardcoded defaults + API-only config | TASK-P0-002, TASK-P0-005 |
| TASK-P2-206 | API Rate Limiting — Token Bucket + Circuit Breaker | No rate limit = exchange bans | TASK-P0-004 |

---

## P3 TASKS (Improvements)

| TASK ID | TASK NAME | WHY | DEPENDENCIES |
|---------|-----------|------|--------------|
| TASK-P3-301 | UI/UX Polish — Accessibility + Responsive | Production-grade UX required | None |
| TASK-P3-302 | Documentation — Runbooks + API Docs | Zero-tribal-knowledge ops | TASK-P0-007 |
| TASK-P3-303 | Performance Profiling — Latency Budgets + SLOs | No performance baseline | TASK-P0-004 |
| TASK-P3-304 | Test Coverage — Comprehensive Suite | Zero test coverage currently | TASK-P1-103 |
| TASK-P3-305 | Structured Logging — JSON + Correlation IDs | Console.log only | TASK-P0-007 |

---

## Summary

| Priority | Tasks | Blocking |
|----------|-------|----------|
| P0 | 7 | Yes (all) |
| P1 | 7 | No |
| P2 | 6 | No |
| P3 | 5 | No |
| **Total** | **25** | **7 blocking** |

**No implementation until human approves this reconciliation and all P0 tasks are scheduled.**
