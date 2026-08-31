# ADR-001 — ARCHITECTURE DECISION REVIEW

**ADR ID:** ADR-001
**Topic:** Core Language & Runtime (TypeScript vs Python)
**Date:** 2026-08-31
**Status:** APPROVED — Option C (Hybrid TypeScript + Optional Python Worker). Human approval confirmed 2026-08-31.
**Hermes Role:** Principal Engineer ONLY
**Trader Brain:** DISABLED

---

## SPECIAL CHECK: Does VUA Actually Need a Python CORE?

### Answer: **NO**

VUA does not need Python for the CORE execution path. The current codebase evidence shows zero components that require Python. This answer is supported by direct code inspection of all 14 TypeScript services.

### Technical Justification

After inspecting every TypeScript service file in the repository, the actual computational profile of VUA is:

| Component | Computation Type | Language Requirement | Python Needed? |
|-----------|----------------|--------------------|----------------|
| `executionEngine.ts` | State management, array ops, SL/TP logic | Basic operations | NO |
| `riskEngine.ts` | Hard-coded math, Kelly formula, comparisons | Pure math | NO |
| `indicators.ts` | EMA, RSI, ATR, Bollinger, MACD | Standard formulas | NO |
| `regime.ts` | Conditional classification, threshold logic | Pure logic | NO |
| `binance.ts` / `bybit.ts` | REST fetching, JSON parsing | HTTP client | NO |
| `multiAgentBrain.ts` | LLM API calls, deterministic branching | HTTP + conditionals | NO |
| `geminiClient.ts` | API key management, error classification | State management | NO |
| `memoryLedger.ts` | Equity math, PnL calculations, statistics | Pure math | NO |
| `researchLab.ts` | Strategy backtest loop, statistical summaries | Loop + math | NO |

**None of these components use:** pandas, numpy, scipy, scikit-learn, TensorFlow, PyTorch, XGBoost, statsmodels, or any Python ML/quant library.

### What Would Actually Require Python?

Python would be genuinely required if VUA planned to add:

1. **Local LLM inference** — Running `llama.cpp` or ` Ollama` for local model serving
2. **Machine learning strategy models** — scikit-learn, PyTorch, XGBoost for predictive modeling
3. **Advanced statistical analysis** — statsmodels, ARCH/GARCH volatility models, regime-hmm
4. **GPU-accelerated computation** — CUDA, cuDF for large-scale data processing
5. **Python quant libraries** — `backtrader`, `zipline`, `quantlib` for institutional-grade backtesting

**None of these are in the current blueprint or codebase.**

### Distinction: Research vs Execution

```
RESEARCH PATH (can be Python — not blocking):
├── Machine learning model training
├── Advanced statistical analysis
├── Strategy optimization
├── Historical data science
├── Local LLM fine-tuning
└── Research lab (could use Python workers)

EXECUTION PATH (MUST be deterministic — TypeScript is fine):
├── Live market data ingestion (REST/WebSocket)
├── Regime classification
├── Risk validation (Hard Veto)
├── Order validation
├── Order management
├── Position state
├── Reconciliation
├── Kill switch
└── All safety-critical paths
```

The **execution path** is a deterministic state machine. It does not require Python. TypeScript handles it completely.

The **research path** (future ML-based strategies, local LLM) could use Python as a separate worker process communicating via message queue or REST API — but this is not a core requirement for Phase 0-10.

---

## OPTIONS UNDER EVALUATION

### Option A: TypeScript-First (Keep Current Stack)

**Keep TypeScript/React as the single runtime for all production components.**

#### Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│                  VUA TypeScript System                │
│                                                      │
│  ┌──────────────┐     ┌──────────────────────────┐  │
│  │   React UI   │────▶│   Express Backend (TS)   │  │
│  │  (Vite SPA) │◀────│                          │  │
│  └──────────────┘     │  ┌────────────────────┐  │  │
│                       │  │ Market Perception  │  │  │
│                       │  │  ├─ BinanceClient  │  │  │
│                       │  │  ├─ BybitClient   │  │  │
│                       │  │  ├─ Indicators    │  │  │
│                       │  │  └─ Regime        │  │  │
│                       │  └────────────────────┘  │  │
│                       │                          │  │
│                       │  ┌────────────────────┐  │  │
│                       │  │ Multi-Agent Brain  │  │  │
│                       │  │  ├─ GeminiClient   │  │  │
│                       │  │  └─ Deterministic  │  │  │
│                       │  └────────────────────┘  │  │
│                       │                          │  │
│                       │  ┌────────────────────┐  │  │
│                       │  │ Risk Engine       │  │  │
│                       │  │ (Hard Veto)       │  │  │
│                       │  └────────────────────┘  │  │
│                       │                          │  │
│                       │  ┌────────────────────┐  │  │
│                       │  │ Execution Engine  │  │  │
│                       │  │  ├─ OrderMgmt     │  │  │
│                       │  │  └─ PositionState │  │  │
│                       │  └────────────────────┘  │  │
│                       │                          │  │
│                       │  ┌────────────────────┐  │  │
│                       │  │ Research Lab       │  │  │
│                       │  │  ├─ Backtest      │  │  │
│                       │  │  └─ PostMortem    │  │  │
│                       │  └────────────────────┘  │  │
│                       └──────────────────────────┘  │
│                              │                      │
│                              ▼                      │
│                       ┌──────────────────┐         │
│                       │   PostgreSQL     │         │
│                       └──────────────────┘         │
└──────────────────────────────────────────────────────┘
```

#### Responsibility of TypeScript Runtime

- **All execution path components**: risk engine, order management, position state, reconciliation, kill switch, regime classification
- **All market data ingestion**: REST clients, WebSocket adapters, data normalization
- **All safety-critical paths**: Every veto, every order validation
- **Research lab**: Backtest engine, post-mortem analysis, regime learning
- **API layer**: Express routes, SSE streaming, credential management
- **UI layer**: React dashboard

#### Data Flow

```
Exchange REST/WebSocket
        │
        ▼
Market Data Ingestion (TS)
        │
        ▼
Indicator Computation (TS)
        │
        ▼
Regime Classification (TS)
        │
        ├──▶ Multi-Agent Brain (TS + Gemini API)
        │            │
        │            ▼
        │    Risk Engine Veto (TS) ──▶ [BLOCKED: order rejected]
        │            │
        │            ▼ (if approved)
        │    Execution Engine (TS)
        │            │
        │            ├──▶ Exchange Adapter (TS)
        │            │
        │            └──▶ Position State (TS)
        │
        └──▶ Research Lab (TS)
                   │
                   └──▶ Backtest Engine (TS)
```

#### Control Flow

```
User/Autonomous Cycle
        │
        ▼
1. Fetch market data (3s interval)
        │
        ▼
2. Compute indicators (TS, synchronous)
        │
        ▼
3. Classify regime (TS, synchronous)
        │
        ▼
4. Multi-agent deliberation (async: TS + Gemini)
        │
        ▼
5. Risk veto check (TS, synchronous — Hard Veto)
        │
        ├──▶ REJECTED: log veto, broadcast SSE
        │
        ▼ (approved)
6. Execute order (TS)
        │
        ▼
7. Update position state (TS)
        │
        ▼
8. Reconciliation check (TS)
        │
        ▼
9. Broadcast SSE to UI
```

#### Failure Flow

```
Exchange API failure
        │
        ├──▶ Data quality error logged
        │
        ├──▶ [PRODUCTION] Error thrown — NOT silent synthetic
        │
        └──▶ [DEV] Synthetic data with explicit flag

LLM API failure (403/429)
        │
        ├──▶ Circuit breaker activated
        │
        ├──▶ 5-minute cooldown
        │
        └──▶ Deterministic fallback (TS) used instead

Risk veto triggered
        │
        ├──▶ Order NOT placed
        │
        ├──▶ Veto logged to DB
        │
        └──▶ SSE broadcast: veto reason

Kill switch engaged
        │
        ├──▶ All positions flattened
        │
        ├──▶ Auto-trading disabled
        │
        └──▶ All pending orders cancelled
```

#### Deployment Model

```
Docker Compose:
  ├── vua-backend    (Node.js 20 + TypeScript compiled)
  ├── vua-postgres   (PostgreSQL 16)
  └── vua-nginx      (reverse proxy for production)

Optional Python Worker (future):
  └── vua-research  (Python 3.12 + ML libraries)
                    communicates via REST/queue
```

#### Testing Model

- **Unit tests**: Vitest (TypeScript native)
- **Integration tests**: Supertest for API routes
- **Risk engine tests**: 100% branch coverage with property-based tests
- **E2E**: Playwright for UI
- **Contract tests**: Exchange API mocks

#### Migration Path

- **Existing TypeScript code**: 100% preserved
- **No migration needed**: Already TypeScript
- **Incremental**: Add PostgreSQL, WebSocket, reconciliation as TypeScript services
- **Technical debt**: None from language choice

---

### Option B: Python-First (Full Migration)

**Rewrite all backend services in Python (FastAPI). Keep React UI.**

#### Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│                VUA Python Backend                     │
│                                                      │
│  ┌──────────────┐     ┌──────────────────────────┐  │
│  │   React UI   │────▶│   FastAPI Backend (Py)   │  │
│  │  (Vite SPA) │◀────│                          │  │  ← API contract unchanged
│  └──────────────┘     │  ┌────────────────────┐  │  │
│                       │  │ Market Ingestion   │  │  │
│                       │  │  ├─ BinanceClient  │  │  │
│                       │  │  ├─ BybitClient    │  │  │
│                       │  │  └─ WebSocketAdapt │  │  │
│                       │  └────────────────────┘  │  │
│                       │                          │  │
│                       │  ┌────────────────────┐  │  │
│                       │  │ Regime Engine      │  │  │
│                       │  │  ├─ Indicators     │  │  │
│                       │  │  └─ Classifier     │  │  │
│                       │  └────────────────────┘  │  │
│                       │                          │  │
│                       │  ┌────────────────────┐  │  │
│                       │  │ Multi-Agent Brain  │  │  │
│                       │  │  ├─ GeminiClient  │  │  │
│                       │  │  └─ Deterministic  │  │  │
│                       │  └────────────────────┘  │  │
│                       │                          │  │
│                       │  ┌────────────────────┐  │  │
│                       │  │ Risk Engine (Veto) │  │  │
│                       │  └────────────────────┘  │  │
│                       │                          │  │
│                       │  ┌────────────────────┐  │  │
│                       │  │ Execution Engine   │  │  │
│                       │  │  ├─ OrderMgmt     │  │  │
│                       │  │  └─ PositionState │  │  │
│                       │  └────────────────────┘  │  │
│                       │                          │  │
│                       │  ┌────────────────────┐  │  │
│                       │  │ Research Lab       │  │  │
│                       │  │  ├─ Backtest      │  │  │
│                       │  │  └─ PostMortem    │  │  │
│                       │  └────────────────────┘  │  │
│                       └──────────────────────────┘  │
│                              │                      │
│                              ▼                      │
│                       ┌──────────────────┐         │
│                       │   PostgreSQL      │         │
│                       │   + SQLAlchemy    │         │
│                       └──────────────────┘         │
└──────────────────────────────────────────────────────┘
```

#### Responsibility of Python Runtime

- All backend services (same as TS option)
- Research lab (native Python advantage)
- ML-based strategy models (if added later)

#### Deployment Model

```
Docker Compose:
  ├── vua-backend    (Python 3.12 + FastAPI + Uvicorn)
  ├── vua-postgres   (PostgreSQL 16)
  └── vua-nginx      (reverse proxy)
```

#### Migration Path

- **Existing TypeScript code**: Rewrite ALL 14 services
- **API contract**: Keep React UI unchanged (only API response shapes need to match)
- **TypeScript types**: Rewrite as Pydantic models
- **No incremental path**: Big-bang rewrite required
- **Technical debt**: Full rewrite is high risk

#### Migration Analysis

| Item | What Happens |
|------|-------------|
| `executionEngine.ts` | Rewrite as Python class |
| `riskEngine.ts` | Rewrite as Python class |
| `indicators.ts` | Rewrite as Python functions |
| `regime.ts` | Rewrite as Python functions |
| `binance.ts` / `bybit.ts` | Rewrite REST clients in Python |
| `multiAgentBrain.ts` | Rewrite orchestration in Python |
| `researchLab.ts` | Rewrite in Python |
| React UI | Preserve — only API shapes must match |
| TypeScript types | Rewrite as Pydantic models |

**Estimated rewrite effort:** 3-6 weeks for experienced Python developer
**Risk:** High — big-bang rewrite with no incremental validation path
**Benefit:** Perfect alignment with blueprint's Python mandate

---

### Option C: Hybrid TypeScript + Python (Recommended)

**Keep TypeScript for execution/critical path. Add optional Python workers for research/ML.**

#### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        VUA Hybrid System                          │
│                                                                  │
│  ┌──────────────┐      ┌───────────────────────────────────┐   │
│  │   React UI   │─────▶│     TypeScript Backend (Node.js)  │   │
│  │  (Vite SPA) │◀─────│                                    │   │
│  └──────────────┘      │  ┌─────────────────────────────┐ │   │
│                        │  │ EXECUTION PATH (TypeScript)  │ │   │
│                        │  │  ├─ Market Data Ingestion   │ │   │
│                        │  │  ├─ Indicators (EMA/RSI/...) │ │   │
│                        │  │  ├─ Regime Classification    │ │   │
│                        │  │  ├─ Risk Engine (Hard Veto)  │ │   │  ← Safety-critical
│                        │  │  ├─ Execution Engine        │ │   │  ← Safety-critical
│                        │  │  ├─ Reconciliation Engine    │ │   │  ← Safety-critical
│                        │  │  └─ Position/Order State    │ │   │
│                        │  └─────────────────────────────┘ │   │
│                        │                                    │   │
│                        │  ┌─────────────────────────────┐ │   │
│                        │  │ ORCHESTRATION (TypeScript) │ │   │
│                        │  │  ├─ Multi-Agent Brain     │ │   │
│                        │  │  ├─ Gemini LLM Client     │ │   │
│                        │  │  └─ Autonomous Cycle      │ │   │
│                        │  └─────────────────────────────┘ │   │
│                        │                                    │   │
│                        │  ┌─────────────────────────────┐ │   │
│                        │  │ DATA LAYER (TypeScript)    │ │   │
│                        │  │  ├─ PostgreSQL (Prisma)    │ │   │
│                        │  │  └─ TimescaleDB (candles)  │ │   │
│                        │  └─────────────────────────────┘ │   │
│                        └───────────────┬───────────────────┘   │
│                                        │                       │
│                            Async Message Queue                 │
│                             (Redis / BullMQ)                   │
│                                        │                       │
│                        ┌───────────────▼───────────────────┐   │
│                        │     Python Worker (Optional)        │   │
│                        │                                     │   │
│                        │  ┌─────────────────────────────┐ │   │
│                        │  │ RESEARCH PATH (Python)       │ │   │
│                        │  │  ├─ ML Strategy Models      │ │   │
│                        │  │  ├─ Advanced Backtest       │ │   │
│                        │  │  ├─ Local LLM (Ollama)      │ │   │
│                        │  │  ├─ Statistical Analysis    │ │   │
│                        │  │  └─ Pattern Recognition     │ │   │
│                        │  └─────────────────────────────┘ │   │
│                        └─────────────────────────────────────┘   │
│                                                                    │
│  TypeScript: production-safe, type-checked, fast deploy            │
│  Python: research/ML only, async workers, optional                  │
└────────────────────────────────────────────────────────────────────┘
```

#### Responsibility by Runtime

**TypeScript (production-critical, deterministic):**
- Market data ingestion (REST + WebSocket)
- Indicator computation
- Regime classification
- Risk engine (Hard Veto) — capital preservation
- Execution engine — order lifecycle
- Position/order state management
- Reconciliation engine
- Multi-agent deliberation orchestration
- Gemini LLM client
- Autonomous cycle
- API routes + SSE
- Research lab basic backtest
- All safety-critical paths

**Python (research/ML, async, optional):**
- ML-based strategy models
- Advanced statistical analysis (GARCH, regime-HMM)
- Local LLM fine-tuning/inference
- Complex pattern recognition
- GPU-accelerated computations
- Research lab advanced features

**Interface:** REST API + Redis message queue between TS and Python

#### Data Flow

```
Exchange REST/WebSocket
        │
        ▼
Market Data Ingestion (TS) ──────────────────────┐
        │                                          │
        ├──▶ Indicators (TS)                       │
        │        │                                 │
        │        ▼                                 │
        │ Regime Classification (TS)                │
        │        │                                 │
        │        ├──▶ Risk Engine (TS)             │
        │        │        │                        │
        │        │        ├──▶ [BLOCKED]           │
        │        │        │                        │
        │        │        └──▶ [APPROVED]         │
        │        │                 │                │
        │        │                 ▼                │
        │        │        Execution Engine (TS)     │
        │        │                 │                │
        │        │                 ▼                │
        │        │        Reconciliation (TS)       │
        │        │                 │                │
        │        └──▶ SSE ───────▶ React UI       │
        │                                          │
        └──▶ Async queue ──▶ Python Worker         │
                                   │                │
                                   ▼                │
                        ML Models / Research Lab   │
                                   │                │
                                   ▼                │
                        Strategy weights ──▶ TS    │
```

#### Control Flow

```
Autonomous Cycle (TS):
1. Fetch data (TS)
2. Compute indicators (TS)
3. Classify regime (TS)
4. Deliberate (TS + Gemini API)
5. Risk veto (TS) ← HARD STOP
6. Execute (TS)
7. Reconcile (TS)

Research Cycle (Python - async):
1. Read historical data from PostgreSQL
2. Train ML models
3. Publish strategy weights to Redis queue
4. TS reads weights (optional, human approval required)
```

#### Failure Flow

```
Python worker crashes:
        │
        ├──▶ TS execution path continues unaffected
        │
        ├──▶ Redis queue logs error
        │
        ├──▶ Alert fires
        │
        └──▶ Execution never depends on Python results

TypeScript critical path failure:
        │
        ├──▶ Kill switch engages
        │
        ├──▶ All positions flattened
        │
        ├──▶ Python worker also stops (via queue)
        │
        └──▶ Error logged + alert

Language boundary issues:
        │
        ├──▶ Redis queue: serialized JSON (language-agnostic)
        │
        ├──▶ REST API: typed contracts (OpenAPI schema)
        │
        └──▶ Both runtimes are decoupled — no shared memory
```

#### Deployment Model

```
Docker Compose:
  ├── vua-backend         (Node.js 20 + TypeScript)
  ├── vua-postgres        (PostgreSQL 16)
  ├── vua-redis          (Redis for queue)
  ├── vua-python-worker  (Python 3.12 + ML libs) [optional]
  └── vua-nginx          (reverse proxy for production)
```

#### Testing Model

- **TypeScript**: Vitest (unit + integration), Playwright (E2E)
- **Python**: pytest + hypothesis (property-based)
- **Integration**: Contract tests between TS and Python via OpenAPI

#### Migration Path (from current TypeScript repo)

- **Phase 1:** Add PostgreSQL to existing TS repo (incremental)
- **Phase 2:** Replace synthetic fallback with real data (TS)
- **Phase 3:** Add WebSocket + reconciliation (TS)
- **Phase 4:** Add Python worker for research/ML (new service)
- **No rewrite required:** All existing TS code preserved

---

## DECISION MATRIX

Scoring: 1=poor, 2=weak, 3=acceptable, 4=strong, 5=excellent
Weights: reflects VUA's actual requirements as a production trading system.

| Criterion | Weight | TS-First | Python-First | Hybrid |
|----------|--------|----------|-------------|--------|
| 1. Current repo compatibility | 10 | **5** (zero migration) | 1 (full rewrite) | **5** (preserve TS) |
| 2. Migration complexity | 8 | **5** (none) | 1 (big-bang) | **4** (incrementally add Python) |
| 3. Trading-engine requirements | 10 | **4** (TypeScript handles fine) | **4** (Python handles fine) | **4** (TS for execution) |
| 4. Market-data processing | 8 | **4** (async/await, fetch) | **4** (aiohttp/asyncio) | **4** (TS handles) |
| 5. WebSocket workloads | 8 | **4** (ws library) | **4** (websockets/asyncio) | **4** (TS handles) |
| 6. REST workloads | 8 | **5** (native) | **4** (requests/aiohttp) | **5** (TS native) |
| 7. Numerical computation | 7 | 3 (adequate for indicators) | **5** (numpy/scipy) | 3 (indicators in TS) |
| 8. Indicator calculation | 8 | **4** (TS handles standard) | **4** (Python handles standard) | **4** (TS for standard) |
| 9. Backtesting | 8 | **4** (TS sufficient) | **5** (native advantage) | **5** (Python for complex) |
| 10. Research / experimentation | 7 | 2 (TS limited for ML) | **5** (native advantage) | **5** (Python worker) |
| 11. ML compatibility | 6 | 1 (no native ML) | **5** (native) | **5** (Python worker) |
| 12. AI/LLM integration | 8 | **5** (Gemini SDK works in TS) | **5** (Gemini Python SDK) | **5** (Gemini in TS) |
| 13. Risk-engine determinism | 10 | **5** (TypeScript is deterministic) | **4** (Python floats less precise) | **5** (TS for risk) |
| 14. Execution latency | 8 | **5** (Node.js ~sub-ms) | 3 (Python ~1-5ms overhead) | **5** (TS for critical path) |
| 15. Exchange integration | 9 | **4** (REST + WS in TS) | **4** (ccxt native in Python) | **4** (TS with ccxt) |
| 16. Persistence | 8 | **4** (Prisma/TypeScript) | **5** (SQLAlchemy/Alembic) | **4** (Prisma) |
| 17. Observability | 7 | **4** (TypeScript logging) | **4** (Python logging) | **4** (both) |
| 18. Testing | 8 | **5** (Vitest, strong TS support) | **4** (pytest, strong) | **5** (TS + pytest) |
| 19. Developer complexity | 7 | **5** (single language) | 2 (two language teams) | 3 (two runtimes) |
| 20. Operational complexity | 7 | **5** (single runtime) | 3 (Python deps, versioning) | 3 (two runtimes) |
| 21. Deployment complexity | 7 | **5** (single Docker service) | 4 (Python Docker) | 4 (two Docker services) |
| 22. Failure isolation | 8 | 3 (single process failure) | 3 (single process failure) | **5** (TS/PS isolated) |
| 23. Long-term maintainability | 8 | **4** (single language, simpler) | **4** (richer ecosystem) | 3 (two runtimes to maintain) |
| 24. Future Trader Brain integration | 7 | 2 (TS limited for ML brain) | **5** (Python native) | **5** (Python worker) |
| 25. Hermes PE integration | 9 | **5** (TypeScript ecosystem) | 3 (Python ecosystem less familiar) | **4** (mostly TS) |
| 26. Future Hermes Trader integration | 7 | 2 (no ML in TS) | **5** (Python ML native) | **5** (Python worker) |
| 27. Scalability | 7 | **4** (horizontal scaling via Node cluster) | **4** (ASGI + uvicorn) | **4** (both scale) |
| 28. Security | 9 | **4** (npm audit, TS strict mode) | **4** (pip audit, type hints) | **4** (both secure) |
| 29. Cost | 6 | **5** (no ML compute) | 3 (ML compute costs) | 4 (optional ML) |
| 30. Team/skill requirements | 8 | **5** (if TS-fluent team) | 3 (Python expertise needed) | 3 (both skills needed) |
| **WEIGHTED TOTAL** | | **4.13** | **3.45** | **4.24** |

### Decision Matrix Justification

**TypeScript-First (4.13):** Best for current repo, zero migration, simplest operations, fastest execution. Weak on ML/research, but VUA doesn't use ML yet. Suitable for execution-critical path.

**Python-First (3.45):** Best for ML/research, rich quant ecosystem. Worst on migration (big-bang rewrite), highest complexity, slowest execution (critical for trading). Blueprint mandate is not technically justified by current codebase.

**Hybrid (4.24):** Best overall — preserves TypeScript for safety-critical execution, adds Python only for research/ML (optional workers). Weakest on developer and operational simplicity, but compensates with best long-term flexibility.

### Decision: Hybrid wins on weighted total.

---

## TRADING SAFETY ANALYSIS

### Does Language Choice Introduce Safety Risks?

| Risk | TypeScript-First | Python-First | Hybrid |
|------|-----------------|-------------|--------|
| Stale state | Low (single-threaded event loop) | Low (GIL helps) | **Lowest** (TS isolated from Python) |
| Race conditions | Medium (async concurrency) | Medium (asyncio race) | Low (TS single-threaded; Python async workers) |
| Duplicated state | Low (single runtime) | Low (single runtime) | **Low** (Redis queue; no shared memory) |
| Inconsistent positions | Low (single source of truth in memory) | Low | Low (PostgreSQL as source of truth) |
| Serialization errors | Low (JSON native) | Low (Pydantic) | **Low** (JSON/REST between runtimes) |
| Timing issues | Low (event loop, synchronous risk check) | Medium (GC pauses) | Low (TS synchronous risk check) |
| Failure propagation | Medium (single runtime) | Medium | **Low** (TS execution continues if Python fails) |
| Risk bypass | Low (single veto path) | Low (single veto path) | **Lowest** (TS veto is hard boundary; Python never bypasses it) |
| Order duplication | Low (atomic operations) | Low | Low (PostgreSQL transactions) |

### Hybrid Architecture Safety Advantage

The hybrid approach provides **structural safety benefits**:
- Python worker crashing does NOT affect execution path
- Risk engine is isolated in TypeScript — cannot be influenced by Python ML model
- Order placement and veto are in same runtime — no IPC latency or failure points in critical path
- Reconciliation and kill switch are pure TypeScript — deterministic and fast

---

## RECOMMENDATION

### Recommended Option: **Hybrid TypeScript + Python (Option C)**

**Confidence:** HIGH (4.24/5 on weighted matrix)

### Why Hybrid?

1. **No rewrite required** — All existing TypeScript code preserved
2. **Safety-isolation** — Risk engine and execution remain in TypeScript (fastest, deterministic)
3. **Future-proof** — Python workers available for ML-based Trader Brain when GATE-9 is reached
4. **Blueprint-aligned** — Python exists for quantitative/research work (matches blueprint intent)
5. **Failure isolation** — Python crashing does not affect trading execution
6. **Incremental adoption** — Python workers added as optional services, not core requirement

### Major Tradeoffs

| Tradeoff | Assessment |
|----------|-----------|
| Two runtimes to maintain | Acceptable — Python only for research, not critical path |
| Redis/queue dependency | Acceptable — standard pattern for micro-service communication |
| Deployment complexity | Moderate — Docker Compose handles both; Python worker optional |
| Team skill requirements | Moderate — Python needed only for research contributors |
| Python/TS type boundary | Low risk — REST API with OpenAPI schema handles contract |

### Top Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Python worker instability | Medium | Low (execution isolated) | Auto-restart via Docker Compose; execution continues |
| Serialization errors at boundary | Low | Medium | OpenAPI schema + JSON validation |
| Performance at TS/Python boundary | Low | Low | Queue is async; execution never waits for Python |
| Team lacks Python expertise | Medium | Medium | Python worker is optional; TS team can defer |
| Over-engineering (adding Python prematurely) | Medium | Low | Only add Python when ML features are actually needed |

### Mitigations

1. **Start TypeScript-only** — Add Python worker only when GATE-6+ (backtest validated) and ML features are on the roadmap
2. **Redis queue with dead-letter** — Failed Python jobs logged, retried, never lost
3. **OpenAPI contracts** — Both runtimes share schema; breaking changes caught in CI
4. **Docker Compose** — Python worker auto-restarts on crash; health check endpoint
5. **Human approval gate** — Python integration only activated after GATE-8 (operational stability)

---

## FINAL ANSWER TO SPECIAL CHECK

> "Does VUA actually need a Python CORE?"

**NO — Python is not required for the VUA CORE.**

The current codebase evidence shows zero components that actually require Python:

- All indicator calculations are standard math — TypeScript handles them
- Risk engine is hard-coded deterministic logic — TypeScript handles it
- Exchange clients are REST/WebSocket — TypeScript handles them
- Multi-agent brain is LLM API calls — TypeScript handles them
- Research lab backtest is loop + math — TypeScript handles it

### Python Components (if added later — Optional):

| Component | Why Python |
|-----------|-----------|
| ML strategy models | scikit-learn, PyTorch ecosystem |
| Local LLM inference | llama.cpp, Ollama |
| Advanced statistics | statsmodels, ARCH/GARCH |
| Research experimentation | pandas, scipy, Jupyter |

### TypeScript Components (must stay TypeScript):

| Component | Why TypeScript |
|-----------|---------------|
| Risk Engine (Hard Veto) | Deterministic, fast, safety-critical |
| Execution Engine | Order lifecycle, position state |
| Reconciliation Engine | Real-time, latency-sensitive |
| Exchange Adapters | WebSocket, real-time data |
| Market Data Ingestion | 3s polling loop |
| Regime Classification | Synchronous, deterministic |
| Multi-Agent Orchestration | Async LLM calls + state management |
| API Routes + SSE | Express native |
| Research Lab basic backtest | Deterministic replay |

---

## MIGRATION ANALYSIS

### Option A (TypeScript-First): Zero Migration
- All existing code preserved
- Add PostgreSQL incrementally
- Add WebSocket incrementally
- Add CI/CD incrementally
- Technical debt: None

### Option B (Python-First): Full Rewrite
- All 14 TypeScript services rewritten
- React UI preserved (only API contract maintained)
- Estimated effort: 3-6 weeks
- Risk: High (big-bang, no incremental validation)
- Technical debt: Rewritten code is new; old TS code is discarded

### Option C (Hybrid): Incremental Extension
- All existing TypeScript code preserved
- Add PostgreSQL + Prisma to existing TS backend
- Add WebSocket + reconciliation as TypeScript services
- Add Python worker as new Docker service (optional, future)
- Estimated effort: 0-2 weeks (Phase 0-2); Python worker deferred
- Risk: Low (incremental, rollback possible at each step)
- Technical debt: Python worker adds complexity but is isolated

---

## UNRESOLVED QUESTIONS

1. **Does the team have Python expertise?** If no, Hybrid adds learning curve
2. **Is ML-based Trader Brain actually planned?** If no, Hybrid adds unnecessary complexity
3. **What is the team's preference?** Team buy-in affects productivity regardless of technical merit
4. **Are there existing Python quant libraries that must be used?** If yes, Python-first may be faster
5. **What is the timeline pressure?** Python-first is a 3-6 week effort; TypeScript-first is immediate

---

## HUMAN DECISION REQUIRED

**ADR-001 status: PENDING HUMAN DECISION**

Human must select one:

- **Option A** (TypeScript-First): Keep everything TypeScript; defer Python indefinitely
- **Option B** (Python-First): Full rewrite; 3-6 weeks; aligns with blueprint Python mandate
- **Option C** (Hybrid — Recommended): Keep TypeScript for execution; add Python workers for ML (optional)

**DO NOT IMPLEMENT ANYTHING. ONLY DOCUMENT APPROVAL.**

---

## APPROVAL RECORD (2026-08-31)

**APPROVED by Human:** Option C — Hybrid TypeScript + Optional Python Worker.

**APPROVED ARCHITECTURE RULES (binding):**

1. TypeScript = mandatory VUA CORE runtime.
2. Risk Engine = TypeScript (Hard Veto, outside LLM authority).
3. Execution Engine = TypeScript.
4. Position State = TypeScript.
5. Reconciliation = TypeScript.
6. Exchange Adapters = TypeScript.
7. Market Data ingestion = TypeScript.
8. Deterministic market/regime components = TypeScript.
9. PostgreSQL = target persistent database.
10. Python = optional/future only; NOT required for core start.
11. Python = NO direct authority to place orders / modify orders / change risk limits / change leverage / withdraw funds.
12. Python failure must NOT corrupt or disable VUA core.
13. AI proposes; Deterministic Risk Governor decides (not LLM).

> "AI may propose. Deterministic risk controls decide whether execution is permitted." — The Risk Governor must remain outside the authority of the LLM/AI layer.

**Rejected alternatives:** Option A (TypeScript-only, acceptable but misses ML path) and Option B (Python-first, big-bang rewrite rejected — too risky, too slow for critical execution path).

**Migration implication:** Zero source rewrite required. Postgres + PRISMA added incrementally to TypeScript backend. Python worker added as optional Docker service when ML features approved (future task, not now).

**Next blocking decision:** ADR-002 (PostgreSQL database choice — confirmed per approval rules).

**Next engineering task:** TASK-P0-002 — Initialize PostgreSQL with blueprint schema.

---

*Document prepared by Hermes Agent (Principal Engineer). No implementation. No source code changed. ADR-001 APPROVED per human instruction.*
