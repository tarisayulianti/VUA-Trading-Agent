# ENGINEERING DEPENDENCY ORDER

Root inspected: /root/projects/VUA-Trading-Agent (read-only audit).
This document defines the technical implementation sequence. Ordered by hard technical dependency and risk, NOT by convenience.

---

## Dependency Order (Bottom-Up)

```
ADR-001 (Language/Stack)
   ↓
ADR-002 (Database)
   ↓
ADR-006 (Persistence Architecture)
   ↓
Data Foundation (GAP-003, ADR-008)
   ↓
Historical Data Store (GAP-201, ADR-007)
   ↓
Exchange Abstraction (GAP-004, ADR-003)
   ↓
Risk Engine Persistence (GAP-005, ADR-006)
   ↓
Reconciliation Engine (GAP-101, ADR-004)
   ↓
Execution Architecture (ADR-004)
   ↓
Backtesting Engine (GAP-006, ADR-007)
   ↓
Paper Trading (GAP-010)
   ↓
Secret Management (GAP-102)
   ↓
Operational Validation (GAP-004, ADR-004)
   ↓
Micro-Live Trading (ADR-004)
   ↓
Testing Baseline (GAP-304, GAP-103)
   ↓
Production Candidate (ADR-009, GAP-105, GAP-106, GAP-107)
   ↓
Stablility Gate (Gate 8)
   ↓
Trader Brain Phase (GAP-204, ADR-005)
   ↓
Final Audit (Gate 11)
   ↓
Go/No-Go (Gate 12)
   ↓
VUA v1.0
```

---

## Why This Order

1. **Language/Stack (ADR-001)** — Must be decided first. Everything else depends on runtime choice (Python vs TypeScript affects ORM, deployment, CI/CD).

2. **Database (ADR-002)** — The repo has zero persistence. Without a database, no state survives restart, no backtesting on real data, no reconciliation, no audit trail. This is the single biggest blocker.

3. **Persistence Architecture (ADR-006)** — Determines how trading events, orders, positions, and risk decisions are stored. Must align with database choice and blueprint's 10-table schema.

4. **Data Foundation (GAP-003)** — Market data is the input to everything. Cannot build a real trading system on synthetic fallback. Must have real WebSocket feeds before execution.

5. **Historical Data Store (GAP-201)** — Required for valid backtesting. Cannot backtest on synthetic candles. Must exist before backtesting engine.

6. **Exchange Abstraction (GAP-004)** — Paper mode is mocked. Real execution requires proper exchange adapters with authentication, WebSocket, and order lifecycle management.

7. **Risk Engine Persistence (GAP-005)** — Risk decisions must be durable and auditable. Requires persistence layer to be complete.

8. **Reconciliation Engine (GAP-101)** — Cannot safely do live trading without verifying local positions against exchange state. Requires execution engine + persistence.

9. **Execution Architecture (ADR-004)** — Live execution. Must come after reconciliation framework exists.

10. **Backtesting Engine (GAP-006)** — Requires historical data store + strategy framework. Must validate before live capital.

11. **Paper Trading (GAP-010)** — Paper mode with real market data (not synthetic). Validation gate before testnet.

12. **Secret Management (GAP-102)** — Keys and credentials. Required before testnet.

13. **Operational Validation** — Monitoring, alerts, health checks operational with real data.

14. **Micro-Live Trading** — Small capital testnet/live. Final validation before production.

15. **Testing Baseline (GAP-304, GAP-103)** — Comprehensive tests. Must be automated and enforced in CI before production candidate.

16. **Production Candidate (ADR-009)** — Full system ready for production. Requires deployment, observability, all gates passed.

17. **Trader Brain Phase** — Only after full production candidate validated. Hermes becomes Trader/Trading Brain.

---

## Critical Path (Must Complete in Order)

ADR-001 → ADR-002 → ADR-006 → GAP-003 → GAP-201 → ADR-003 → GAP-005 → GAP-101 → ADR-004 → GAP-006 → Paper → GAP-102 → Micro-Live → Tests → Production

## Parallelizable (After Critical Path Starts)

- GAP-202 (Strategy Framework) — can start after ADR-006
- GAP-203 (Multi-Symbol) — can start after GAP-002
- GAP-105 (Position Sizing Validation) — can start after ADR-006
- GAP-106 (Funding Rate Integration) — can start after ADR-006
- GAP-204 (Alerting) — can start after ADR-009
- GAP-205 (Config Management) — can start after ADR-006
- GAP-206 (Rate Limiting) — can start after ADR-003

## Key Constraints

- **Hermes = Principal Engineer ONLY** until Gate 5 (micro-live validated)
- **Trader Brain DISABLED** until Gate 8 (stability gate passed)
- **No live trading** until after micro-live validation
- **No autonomous live trading** under any circumstances during this phase
- All health gates require evidence artifacts (see 28-health-gates.md)
- No source code modification until post-human-approval of this reconciliation