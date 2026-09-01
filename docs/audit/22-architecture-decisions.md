# ARCHITECTURE DECISION REGISTER

Root inspected: /root/projects/VUA-Trading-Agent (read-only audit).
This document records unresolved architecture decisions. No decision is APPROVED without explicit human approval.

---

## ADR-001: Core Language & Runtime (TypeScript vs Python)

**QUESTION:** Should the VUA trading system core be implemented in TypeScript (current) or Python (blueprint mandate)?

**WHY IT MATTERS:** 
- Blueprint explicitly mandates Python with dataclasses, ABC abstractions, and separate module directories (core/, intelligence/, strategies/, brain/, execution/)
- Current repo is TypeScript/React (Vite + Express)
- Language choice affects: type safety, ecosystem, team expertise, deployment, AI/ML integration, performance, hiring

**CURRENT STATE:** TypeScript/React (Vite + Express) with 14 service files. All core logic in TypeScript.

**OPTIONS:**

| Option | Pros | Cons | Impact |
|--------|------|------|--------|
| A: Keep TypeScript | Already implemented; single repo; shared types frontend/backend; Vite/Express mature; team may know TS | Deviates from blueprint; Python better for ML/quant libraries; blueprint team expertise may be Python | P0 - blocks all downstream work until resolved |
| B: Migrate to Python (FastAPI) | Matches blueprint 100%; Python quant/ML ecosystem; dataclasses + ABC; separate service architecture | Rewrite all 14 services; separate backend from frontend; new deployment; team ramp-up | P0 - 2-4 weeks rewrite effort |
| C: Hybrid (TS frontend, Python backend) | Matches blueprint backend; keeps React UI; separation of concerns | Two languages; API contract management; dual deployment; more complex ops | P0 - moderate complexity, keeps UI |

**DEPENDENCIES:** All subsequent architecture decisions depend on this.

**RECOMMENDATION:** Option C (Hybrid) — keeps React frontend as dashboard, builds Python backend per blueprint. Minimizes rewrite while matching blueprint architecture.

**DECISION STATUS:** APPROVED — Option C (Hybrid TypeScript + Optional Python Worker). Human approval confirmed 2026-08-31.

**APPROVED ARCHITECTURE RULES:**
- TypeScript = mandatory VUA CORE runtime.
- Risk Engine = TypeScript (Hard Veto, outside LLM authority).
- Execution Engine = TypeScript.
- Position State = TypeScript.
- Reconciliation = TypeScript.
- Exchange Adapters = TypeScript.
- Market Data ingestion = TypeScript.
- Deterministic market/regime = TypeScript.
- PostgreSQL = target persistent DB.
- Python = optional/future only; NOT required for core start.
- Python = NO direct authority to place orders / modify orders / change risk limits / change leverage / withdraw funds.
- Python failure must NOT corrupt or disable VUA core.
- AI may propose. Deterministic Risk Governor decides execution permission.

---

### ADR-001 REVIEW (2026-08-31)

A comprehensive architecture decision review has been completed for ADR-001.
**Full review document:** `docs/audit/28-adr-001-architecture-review.md`

Key findings of the review:

1. **VUA does NOT need a Python CORE.** Direct code inspection of all 14 TypeScript services shows zero components that require Python. None use pandas, numpy, scipy, scikit-learn, TensorFlow, or PyTorch.

2. **Python IS needed for:** ML-based strategy models (future), local LLM inference (future), advanced statistics (GARCH), research experimentation.

3. **TypeScript IS required for:** Risk engine (deterministic, hard veto), execution engine (order lifecycle, position state), reconciliation engine, exchange adapters, market data ingestion, regime classification, multi-agent orchestration.

4. **Weighted decision matrix result:**
   - TypeScript-First: 4.13 / 5
   - Python-First: 3.45 / 5
   - **Hybrid (TypeScript execution + Python research): 4.24 / 5**

5. **Final recommendation:** **Hybrid (Option C)** — preserves TypeScript for execution-critical path, adds Python workers for ML/research only (optional).

6. **Safety analysis:** Hybrid provides structural safety benefits — Python worker crashing does not affect execution path. Risk engine isolation in TypeScript prevents ML bypass.

7. **Migration analysis:** Hybrid requires zero rewrite of existing TypeScript code. Python worker is added as optional Docker service when ML features are planned.

**ADR-001 STATUS: PENDING HUMAN DECISION** — awaiting human approval to select A, B, or C.

---

## ADR-002: Database Choice (Dual-Profile — SQLite + PostgreSQL 16)

**QUESTION:** Which database for persistent trading state, orders, positions, audit logs?

**WHY IT MATTERS:** Blueprint mandates PostgreSQL with 10 DDL tables. Current repo has zero persistence. PostgreSQL 16 cannot run in Android/Termux/PRoot environments (environment limitation confirmed via four exhaustive recovery attempts: uDocker pull blocked, native apt package absent, PGDG dependency conflict, no pre-existing binary).

**CURRENT STATE:** No database. Memory-only EpistemicMemoryLedger with seeded fake history.

**DECISION (APPROVED — DUAL-PROFILE):**

| Profile | Database | Provider | Environment | Status |
|---------|----------|----------|-------------|--------|
| Profile A | SQLite 3 | `prisma` with `sqlite` | Android / Termux / Ubuntu PRoot | APPROVED for local dev |
| Profile B | PostgreSQL 16 | `prisma` with `postgresql` | PC / Server / Production | APPROVED for production |

**PROFILE A (SQLite):**
- Single-device, local persistence
- Single process only — not production-grade
- Development/testing on Android devices
- Full Prisma ORM support
- WAL mode + FK enforcement required

**PROFILE B (PostgreSQL 16):**
- Production-grade ACID guarantees
- Full concurrent write support
- Docker Compose deployment
- Full Prisma ORM support
- NUMERIC precision for financial data

**DEPENDENCIES:** ADR-001 (language determines ORM choice: Prisma for TypeScript).

**ORM:** Prisma (single schema, provider-switched at build time)
**Migration:** Shared directory; provider-compatible SQL only
**DATABASE_URL:** Determined by deployment profile

**KEY CONSTRAINTS:**
- SQLite is NOT a production replacement for PostgreSQL
- Profile A is local/single-device only
- Schema must remain compatible with both providers
- Decimal precision difference documented (SQLite = floating-point approximation)
- Production deployment must use Profile B (PostgreSQL 16)

**DOCUMENTATION:** See `29-adr-002-database-review.md` (revised 2026-09-01)

**DECISION STATUS:** APPROVED — Dual-Profile (revised 2026-09-01)

---

## ADR-003: Exchange Abstraction Layer

**QUESTION:** How to abstract Binance/Bybit for paper/testnet/live?

**WHY IT MATTERS:** Current REST clients have synthetic fallback that masks production failures. Need WebSocket for real-time, reconciliation, HMAC signing.

**CURRENT STATE:** REST clients (binance.ts, bybit.ts) with synthetic fallback. No WebSocket. No reconciliation. Live dispatch stub.

**OPTIONS:**

| Option | Pros | Cons | Impact |
|--------|------|------|--------|
| A: Custom adapter per exchange (interface) | Full control; testable; blueprint-aligned | More code to maintain | P0 - required for live |
| B: ccxt library | Mature; many exchanges; WebSocket support | Heavyweight; less control over internals | P1 - faster to implement |
| C: Lightweight wrapper over ccxt | Best of both | Wrapper maintenance | P1 |

**DEPENDENCIES:** ADR-001, ADR-002 (persistence for order reconciliation).

**RECOMMENDATION:** Custom interface + ccxt for WebSocket transport. Interface in core, ccxt as transport.

**DECISION STATUS:** PENDING HUMAN DECISION (depends on ADR-001)

---

## ADR-004: Execution Architecture (Paper → Live Transition)

**QUESTION:** How to safely transition from paper to live trading?

**WHY IT MATTERS:** Blueprint requires deterministic risk veto, reconciliation, kill switch, micro-live validation. Current executionEngine.ts has live dispatch stub only.

**CURRENT STATE:** Paper mode works with synthetic data. Live mode has empty dispatchToLiveExchange().

**OPTIONS:**

| Option | Pros | Cons | Impact |
|--------|------|------|--------|
| A: Shadow mode (paper + live parallel) | Validate before real money; compare fills | Complex; dual execution | P0 - safety requirement |
| B: Gradual (paper → testnet → micro-live) | Incremental risk; blueprint-aligned | Slow; requires testnet infra | P0 - blueprint path |
| C: Feature-flagged live with circuit breakers | Simpler | Less validation | P1 - riskier |

**DEPENDENCIES:** ADR-003 (exchange adapter), ADR-002 (persistence for reconciliation), ADR-006 (risk engine).

**RECOMMENDATION:** Option B per blueprint. Shadow mode (A) as validation layer within testnet.

**DECISION STATUS:** PENDING HUMAN DECISION (depends on ADR-001)

---

## ADR-005: AI Orchestration (Gemini vs Local/Other)

**QUESTION:** How to orchestrate multi-agent LLM reasoning with deterministic fallback?

**WHY IT MATTERS:** Current geminiClient.ts has circuit breaker for 403/429. Multi-agent brain uses Gemini with deterministic fallback. Need reliability, cost control, observability.

**CURRENT STATE:** GoogleGenAI (@google/genai) with 5-minute cooldown on failure. Deterministic fallback in multiAgentBrain.ts.

**OPTIONS:**

| Option | Pros | Cons | Impact |
|--------|------|------|--------|
| A: Current (Gemini + deterministic fallback) | Working; simple; cost-effective | Single vendor; quota limits | P1 - works but vendor lock-in |
| B: Multi-provider (OpenRouter, local Ollama) | Resilience; cost optimization | Complex routing; prompt compatibility | P2 - future |
| C: Local LLM only (no cloud) | Zero cost; privacy; deterministic | Hardware needs; model quality | P3 - later |

**DEPENDENCIES:** ADR-001 (language affects SDK).

**RECOMMENDATION:** Keep current for now (A). Abstract provider behind interface for future multi-provider.

**DECISION STATUS:** PENDING HUMAN DECISION (depends on ADR-001)

---

## ADR-006: Persistence Architecture (Event Sourcing vs CRUD)

**QUESTION:** How to persist trading events, decisions, positions for audit and learning?

**WHY IT MATTERS:** Blueprint mandates 10 tables including market_events, signals, risk_decisions. Current memory-only ledger loses everything on restart.

**CURRENT STATE:** In-memory arrays (orders, positions, closedTrades). Seeded fake history.

**OPTIONS:**

| Option | Pros | Cons | Impact |
|--------|------|------|--------|
| A: CRUD tables (blueprint DDL) | Simple; matches blueprint; SQL queries | No full audit trail of state changes | P0 - minimum viable |
| B: Event sourcing + projections | Complete audit trail; temporal queries; learning replay | Complex; new paradigm | P1 - better for learning |
| C: Hybrid (CRUD + event log) | Best of both | More tables | P1 - recommended |

**DEPENDENCIES:** ADR-002 (database choice), ADR-001 (language/ORM).

**RECOMMENDATION:** Option C — Blueprint tables + append-only event log for learning/replay.

**DECISION STATUS:** PENDING HUMAN DECISION (depends on ADR-001)

---

## ADR-007: Backtesting Architecture

**QUESTION:** How to run deterministic, reproducible backtests on historical data?

**WHY IT MATTERS:** Current researchLab.ts uses synthetic candles. No historical data store. Cannot validate strategies.

**CURRENT STATE:** Backtest runs on synthetic/synthetic-fallback candles. Deterministic logic but fake data.

**OPTIONS:**

| Option | Pros | Cons | Impact |
|--------|------|------|--------|
| A: Historical DB + replay engine | Real data; deterministic; OOS validation | Data storage; quality issues | P0 - required |
| B: CSV/Parquet files | Simple; portable | No query; manual management | P2 - dev only |
| C: Exchange API historical (limited) | Real data | Rate limits; gaps; no OOS | P1 - insufficient alone |

**DEPENDENCIES:** ADR-002 (persistence), ADR-003 (exchange adapter for data fetch).

**RECOMMENDATION:** Build historical candle store (PostgreSQL/TimescaleDB) + replay engine. Fetch once, store forever.

**DECISION STATUS:** PENDING HUMAN DECISION (depends on ADR-001)

---

## ADR-008: Market Data Architecture (Polling vs WebSocket)

**QUESTION:** REST polling (current) vs WebSocket streaming for real-time data?

**WHY IT MATTERS:** Current 3s polling + synthetic fallback. WebSocket needed for low-latency execution, order book depth, real fills.

**CURRENT STATE:** REST polling every 3s. Synthetic fallback on timeout/error. No WebSocket.

**OPTIONS:**

| Option | Pros | Cons | Impact |
|--------|------|------|--------|
| A: WebSocket primary, REST fallback | Real-time; low latency; order book depth | Connection management; reconnection logic | P0 - required for live |
| B: REST only (current) | Simple; works for paper | High latency; misses micro-structure | P0 - blocks live |
| C: Hybrid (WS for execution, REST for backup) | Resilience | Dual maintenance | P1 - pragmatic |

**DEPENDENCIES:** ADR-003 (exchange adapter).

**RECOMMENDATION:** WebSocket primary for execution symbols; REST for auxiliary/historical.

**DECISION STATUS:** PENDING HUMAN DECISION (depends on ADR-001)

---

## ADR-009: Deployment Architecture

**QUESTION:** How to deploy VUA (container, serverless, bare metal)?

**WHY IT MATTERS:** Blueprint implies production deployment with health gates. Current: no deployment config.

**CURRENT STATE:** No Dockerfile, no CI/CD, no health checks, no deployment docs.

**OPTIONS:**

| Option | Pros | Cons | Impact |
|--------|------|------|--------|
| A: Docker + Kubernetes | Production-standard; scaling; self-healing | Complex; overkill for single instance | P1 - if scale needed |
| B: Docker Compose (single host) | Simple; reproducible; blueprint-compatible | Single point of failure | P0 - minimum viable |
| C: Systemd + bare metal | Simple; low overhead | Manual; no isolation | P2 - not recommended |

**DEPENDENCIES:** ADR-001, ADR-002, ADR-003.

**RECOMMENDATION:** Docker Compose for single-host production (PostgreSQL + Redis + Backend + Frontend nginx). K8s later if scale.

**DECISION STATUS:** PENDING HUMAN DECISION (depends on ADR-001)

---

## Summary: Decision Status

| ADR | Topic | Status | Priority |
|-----|-------|--------|----------|
| ADR-001 | TypeScript vs Python | **APPROVED** — Option C (Hybrid TS + Optional Python Worker) | **APPROVED** |
| ADR-002 | Database (PostgreSQL) | PROPOSED | P0 |
| ADR-003 | Exchange Abstraction | PROPOSED | P0 |
| ADR-004 | Execution Architecture | PROPOSED | P0 |
| ADR-005 | AI Orchestration | PROPOSED | P1 |
| ADR-006 | Persistence Architecture | PROPOSED | P0 |
| ADR-007 | Backtesting Architecture | PROPOSED | P0 |
| ADR-008 | Market Data (WS vs REST) | PROPOSED | P0 |
| ADR-009 | Deployment Architecture | PROPOSED | P1 |

**ADR-001 APPROVED (2026-08-31):** Option C — Hybrid TypeScript + Optional Python Worker.
- TypeScript = mandatory VUA CORE (Risk/Execution/Position/Reconciliation/Exchange/Market Data/Regime/AI Orchestration).
- PostgreSQL = target DB.
- Python = optional/future only; NOT required for core start.
- Python has NO direct execution authority (no orders, no risk changes, no leverage changes, no withdrawals).
- Python failure must NOT corrupt VUA core.
- AI proposes; Deterministic Risk Governor decides (not LLM).
- All other ADRs (002-009) remain PENDING HUMAN DECISION (depend on ADR-001).