# MASTER GAP LIST

Root inspected: /root/projects/VUA-Trading-Agent (read-only audit).
Derived from: blueprint reconciliation (20-blueprint-reconciliation.md), roadmap reconciliation (21-roadmap-reconciliation.md), architecture decisions (22-architecture-decisions.md).

Severity: P0 = blocks safe system development/operation | P1 = major architectural/security/risk/functional problem | P2 = important missing capability | P3 = improvement.

---

## P0 — Blocks Safe System Development/Operation

| GAP ID | CATEGORY | DESCRIPTION | CURRENT STATE | TARGET STATE | SEVERITY | DEPENDENCIES | AFFECTED FILES/MODULES | VALIDATION | ACCEPTANCE CRITERIA | BLOCKING |
|--------|----------|-------------|---------------|--------------|----------|--------------|------------------------|------------|---------------------|----------|
| GAP-001 | Language/Architecture | Blueprint mandates Python core; repo is TypeScript | 14 TypeScript services; React frontend | Decision: Python backend + TS frontend (hybrid) OR full TypeScript | P0 | ADR-001 | All server/services/*.ts | Architecture decision approved | Human approves ADR-001 | BLOCKING |
| GAP-002 | Persistence | No database; all state in memory | EpistemicMemoryLedger with seeded fake history | PostgreSQL with 10 blueprint tables + event log | P0 | ADR-001, ADR-002 | memoryLedger.ts, all services needing state | DB schema applied; data survives restart | All trades/positions/orders persist; ledger survives restart | BLOCKING |
| GAP-003 | Market Data Integrity | Synthetic fallback masks production failures | binance.ts/bybit.ts return synthetic on any error/timeout | Real-time WebSocket feeds; REST only for historical/fallback with explicit flags | P0 | ADR-003, ADR-008 | binance.ts, bybit.ts, api.ts perception loop | Live data flows without synthetic in normal operation | Zero synthetic data in production path; explicit "synthetic mode" flag only for dev | BLOCKING |
| GAP-004 | Exchange Execution | Live dispatch is stub; no HMAC signing; no reconciliation | executionEngine.ts dispatchToLiveExchange() empty | WebSocket + REST authenticated execution; order reconciliation engine | P0 | ADR-003, ADR-004, ADR-002 | executionEngine.ts, exchange adapters | Testnet orders placed & reconciled | Orders reach testnet; fills reconciled; positions match exchange | BLOCKING |
| GAP-005 | Risk Engine Persistence | Risk config in memory; no audit trail of vetoes | riskEngine.ts config in memory; no DB | Risk decisions persisted; config durable; veto audit log | P0 | ADR-002, ADR-006 | riskEngine.ts, memoryLedger.ts | Risk vetoes queryable from DB | Every veto logged with full context; config survives restart | BLOCKING |
| GAP-006 | Backtesting Data | Backtests run on synthetic candles only | researchLab.ts uses synthetic/synthetic-fallback | Historical candle store (PostgreSQL/TimescaleDB); deterministic replay | P0 | ADR-002, ADR-007 | researchLab.ts, exchange adapters | Backtest on real historical data matches paper | OOS validation passes; results reproducible | BLOCKING |
| GAP-007 | Health Gates | No enforced health gates in CI/CD | No CI/CD; no gate enforcement | Gates 0-12 enforced in pipeline with evidence | P0 | ADR-009, all prior | New CI/CD pipeline | Each gate requires evidence artifact | Gate N cannot pass without evidence file | BLOCKING |

---

## P1 — Major Architectural, Security, Risk, or Functional Problem

| GAP ID | CATEGORY | DESCRIPTION | CURRENT STATE | TARGET STATE | SEVERITY | DEPENDENCIES | AFFECTED FILES/MODULES | VALIDATION | ACCEPTANCE CRITERIA | BLOCKING |
|--------|----------|-------------|---------------|--------------|----------|--------------|------------------------|------------|---------------------|----------|
| GAP-101 | Reconciliation Engine | No position/order reconciliation with exchange | Memory-only positions; no exchange sync | Reconciliation engine comparing local vs exchange state every tick | P1 | ADR-003, ADR-004, GAP-004 | executionEngine.ts, new reconciliation module | Testnet reconciliation matches | Local positions = exchange positions within tolerance | NON-BLOCKING (needs live execution first) |
| GAP-102 | Secret Management | API keys in memory; no rotation; no audit | executionEngine.ts stores keys in memory | Vault/secret manager; rotation; audit log; HMAC signing per request | P1 | ADR-002, ADR-009 | executionEngine.ts, credentials endpoint | Keys never in code/logs; rotation tested | Zero plaintext keys in memory >5min; audit trail complete | NON-BLOCKING (dev can use testnet keys) |
| GAP-103 | Deterministic Risk Veto Testing | Risk engine tested only via UI; no unit/integration tests | No test files found | Comprehensive test suite for every veto condition | P1 | ADR-002, GAP-002 | riskEngine.ts, new test files | 100% coverage on veto logic | Every veto reason tested; edge cases covered | NON-BLOCKING |
| GAP-104 | Multi-Agent Observability | Agent debates only in SSE; no persistent log | Debates in memory; broadcast via SSE | Persistent debate log; decision audit trail | P1 | ADR-002, ADR-006 | multiAgentBrain.ts, api.ts | Full deliberation history queryable | Every trade has full agent debate trace in DB | NON-BLOCKING |
| GAP-105 | Order Book Depth / Liquidity | Only top 20 levels; no aggregation; no quality score | binance.ts/bybit.ts limit=20/25; synthetic fallback | Full depth (100+ levels); liquidity quality score; anomaly detection | P1 | ADR-003, ADR-008 | binance.ts, bybit.ts, indicators.ts | Liquidity score used in risk veto | Risk engine rejects on poor liquidity quality | NON-BLOCKING |
| GAP-106 | Funding Rate Integration | Funding rate fetched but not fully used in risk | fundingRate in ticker; used in regime only | Funding rate in risk sizing; max funding thresholds per regime | P1 | ADR-006 | riskEngine.ts, regime.ts, multiAgentBrain.ts | Risk vetoes on extreme funding | Long blocked when funding > threshold | NON-BLOCKING |
| GAP-107 | Position Sizing Validation | Kelly sizing in riskEngine; no independent validation | Single calculation path | Independent validation service; unit tests | P1 | GAP-103 | riskEngine.ts, new validation module | Sizing matches independent calc | Cross-validated sizing within 0.1% | NON-BLOCKING |

---

## P2 — Important Missing Capability

| GAP ID | CATEGORY | DESCRIPTION | CURRENT STATE | TARGET STATE | SEVERITY | DEPENDENCIES | AFFECTED FILES/MODULES | VALIDATION | ACCEPTANCE CRITERIA | BLOCKING |
|--------|----------|-------------|---------------|--------------|----------|--------------|------------------------|------------|---------------------|----------|
| GAP-201 | Historical Data Store | No historical candle database | Only live/synthetic candles | TimescaleDB/PostgreSQL hypertable for candles | P2 | ADR-002, ADR-007 | New data ingestion service | Backfill works; queries fast | 1+ years 1m candles queryable <100ms | NON-BLOCKING |
| GAP-202 | Strategy Framework | Hardcoded strategies in researchLab/backtest | Backtest logic embedded in researchLab.ts | Pluggable strategy interface; registry; config-driven | P2 | GAP-006, ADR-006 | researchLab.ts, new strategy module | Strategies swappable without code change | New strategy added in config only | NON-BLOCKING |
| GAP-203 | Portfolio / Multi-Symbol | Single symbol (BTC/USDT) hardcoded | selectedSymbol in api.ts; single position set | Multi-symbol portfolio; correlation risk; capital allocation | P2 | GAP-002, GAP-004 | api.ts, executionEngine.ts, riskEngine.ts | Multiple positions across symbols | Portfolio risk metrics computed | NON-BLOCKING |
| GAP-204 | Alerting / Notification | No alerts except UI toast | Console logs only | Structured alerts (Telegram/email/Slack); severity routing | P2 | ADR-009 | New alerting module | Alerts fire on circuit breaker/kill switch | Alert delivered <30s of event | NON-BLOCKING |
| GAP-205 | Configuration Management | Risk config via API only; no file/env config | riskEngine.updateConfig() via API | Declarative config (YAML/JSON); versioned; validated | P2 | ADR-002 | riskEngine.ts, new config module | Config loads from file; validated on start | Invalid config rejected at startup | NON-BLOCKING |
| GAP-206 | API Rate Limiting / Resilience | No rate limiting on REST calls; naive retry | AbortController timeout only | Token bucket per exchange; exponential backoff; circuit breaker | P2 | ADR-003 | binance.ts, bybit.ts | No 429 errors in normal operation | Rate limits respected; backoff works | NON-BLOCKING |

---

## P3 — Improvement

| GAP ID | CATEGORY | DESCRIPTION | CURRENT STATE | TARGET STATE | SEVERITY | DEPENDENCIES | AFFECTED FILES/MODULES | VALIDATION | ACCEPTANCE CRITERIA | BLOCKING |
|--------|----------|-------------|---------------|--------------|----------|--------------|------------------------|------------|---------------------|----------|
| GAP-301 | UI/UX Polish | React UI functional but not production-polished | Working dashboard | Accessibility; responsive; dark mode; keyboard nav | P3 | - | src/components/*.tsx | WCAG AA; Lighthouse >90 | Passes accessibility audit | NON-BLOCKING |
| GAP-302 | Documentation | Architecture docs exist; no runbooks/ops guide | SYSTEM_ARCHITECTURE.md, README.md | Runbooks; ops guide; API docs; architecture decision log | P3 | ADR-009 | New docs/ | New operator can deploy from docs | Zero-tribal-knowledge deployment | NON-BLOCKING |
| GAP-303 | Performance Profiling | No profiling; no benchmarks | No perf tools | Continuous profiling; latency budgets; SLOs | P3 | ADR-009 | New profiling setup | P99 latency <100ms for perception loop | Meets latency budgets | NON-BLOCKING |
| GAP-304 | Test Coverage | No test files in repo | Zero tests | Unit >80%; integration >60%; contract tests for exchanges | P3 | GAP-103 | New test suite | CI passes with coverage gates | Coverage enforced in CI | NON-BLOCKING |
| GAP-305 | Logging Structured | Console.log only; no structured logging | console.log/console.error | JSON structured logs; correlation IDs; log levels | P3 | ADR-009 | All services | Logs queryable; correlation works | Every request traceable end-to-end | NON-BLOCKING |

---

## Summary by Severity

| Severity | Count | Blocking | Non-Blocking |
|----------|-------|----------|--------------|
| P0 | 7 | 7 | 0 |
| P1 | 7 | 0 | 7 |
| P2 | 6 | 0 | 6 |
| P3 | 5 | 0 | 5 |
| **Total** | **25** | **7** | **18** |

**All P0 gaps are BLOCKING.** No production work can proceed until ADR-001 (language) and ADR-002 (database) are resolved, then GAP-002 through GAP-007 addressed in dependency order.