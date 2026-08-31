# HEALTH GATES

Root inspected: /root/projects/VUA-Trading-Agent (read-only audit).
Defines objective acceptance criteria for each health gate. Passing a gate must require evidence.

GATE 0 — REPOSITORY UNDERSTOOD

| Field | Value |
|-------|-------|
| GATE ID | GATE-0 |
| ENTRY CRITERIA | New agent assigned to VUA project. |
| EXIT CRITERIA | Agent has read all governance docs (SYSTEM_ARCHITECTURE.md, VUA_ARCHITECTURE_AUDIT.md, README.md, AGENTS.md, package.json). Can state repo purpose, language, framework, current phase. |
| EVIDENCE REQUIRED | `docs/audit/20-blueprint-reconciliation.md` exists with populated reconciliation table. Agent can reproduce audit findings from source files. |
| FAIL CONDITIONS | Agent cannot locate key files. Repo purpose ambiguous. Language/framework unclear. |
| WHO/WHAT MAY APPROVE | Human Principal Engineer or designated architect. |

---

GATE 1 — ARCHITECTURE BASELINE

| Field | Value |
|-------|-------|
| GATE ID | GATE-1 |
| ENTRY CRITERIA | GATE-0 passed. Architecture Decision Register (ADR) created. |
| EXIT CRITERIA | All critical ADRs documented. ADR-001 (language/stack) decided. ADR-002 (database) decided. ADR-003 (exchange abstraction) decided. Architecture baseline complete. |
| EVIDENCE REQUIRED | `docs/audit/22-architecture-decisions.md` with all ADRs filled. One option approved per ADR (PROPOSED/PENDING HUMAN DECISION/APPROVED/REJECTED). Architecture decision log shows human approval signatures. |
| FAIL CONDITIONS | ADR-001 or ADR-002 left in PENDING HUMAN DECISION without timeline. ADR-003 no option selected. |
| WHO/WHAT MAY APPROVE | Human Principal Engineer approves ADR decisions. |

---

GATE 2 — CORE SYSTEM FUNCTIONAL

| Field | Value |
|-------|-------|
| GATE ID | GATE-2 |
| ENTRY CRITERIA | GATE-1 passed. PostgreSQL initialized with basic schema. Exchange adapters can connect to testnet. Multi-agent debate runs end-to-end. |
| EXIT CRITERIA | Core system operational: DB persists state across restart. Exchange adapter (testnet) places and cancels orders. Multi-agent debate produces final verdict. |
| EVIDENCE REQUIRED | `docs/audit/gate-evidence/gate-2-core-functional.md` exists with: (1) DB migration run log. (2) Testnet order placement + cancellation proof. (3) Multi-agent debate JSON output from `/api/deliberate` endpoint. |
| FAIL CONDITIONS | DB does not survive restart. Testnet order fails to place or cancel. Multi-agent debate hangs or errors. |
| WHO/WHAT MAY APPROVE | Human Principal Engineer reviews evidence. |

---

GATE 3 — TESTING BASELINE

| Field | Value |
|-------|-------|
| GATE ID | GATE-3 |
| ENTRY CRITERIA | GATE-2 passed. Risk engine unit tests written. Multi-agent debate audit log created. |
| EXIT CRITERIA | Test suite runs in CI. 100% branch coverage on risk engine. All veto conditions tested. Audit log queryable. |
| EVIDENCE REQUIRED | `docs/audit/gate-evidence/gate-3-testing.md` exists with: (1) CI pipeline screenshot showing test stage passing. (2) Coverage report summary (branch coverage %. `>= 100%` on risk engine). (3) Sample audit log entries from risk vetoes. |
| FAIL CONDITIONS | CI test stage fails. Coverage < 100% on risk engine. Audit log missing entries. |
| WHO/WHAT MAY APPROVE | Human Principal Engineer reviews CI output. |

---

GATE 4 — RISK BOUNDARY VERIFIED

| Field | Value |
|-------|-------|
| GATE ID | GATE-4 |
| ENTRY CRITERIA | GATE-3 passed. Comprehensive risk veto test suite. Kill switch functional. Circuit breaker at boundary values tested. |
| EXIT CRITERIA | Risk boundary enforced deterministically. No trade approved when any check fails. Kill switch engagement flattens all positions. Circuit breaker trips at exact threshold. |
| EVIDENCE REQUIRED | `docs/audit/gate-evidence/gate-4-risk-boundary.md` exists with: (1) Test report showing every veto condition passes/fails as expected. (2) Kill switch engagement test video/screenshot. (3) Circuit breaker trip at exactly `maxDailyDrawdownPercent`. |
| FAIL CONDITIONS | Any trade approved when risk check fails. Kill switch does not flatten positions. Circuit breaker does not trip at threshold. |
| WHO/WHAT MAY APPROVE | Human Principal Engineer + Human Risk Officer. |

---

GATE 5 — EXCHANGE INTEGRATION VERIFIED

| Field | Value |
|-------|-------|
| GATE ID | GATE-5 |
| ENTRY CRITERIA | GATE-4 passed. Reconciliation engine runs. Testnet credentials configured. |
| EXIT CRITERIA | Full exchange integration verified on testnet: orders placed, filled, canceled, positions reconciled. No silent divergence. |
| EVIDENCE REQUIRED | `docs/audit/gate-evidence/gate-5-exchange-integration.md` exists with: (1) Testnet trade lifecycle: place → fill → reconcile → close. (2) Reconciliation report: 0 mismatches or all documented + resolved. (3) Kill switch engagement from testnet. |
| FAIL CONDITIONS | Silent divergence (local position ≠ exchange position, no log). Reconciliation fails to detect injected mismatch. Kill switch not reachable from testnet. |
| WHO/WHAT MAY APPROVE | Human Principal Engineer + Human Trader (if available). |

---

GATE 6 — BACKTEST VALIDATED

| Field | Value |
|-------|-------|
| GATE ID | GATE-6 |
| ENTRY CRITERIA | GATE-5 passed. Historical data store operational. Backtest engine deterministic. |
| EXIT CRITERIA | Backtest on real historical data produces reproducible results. Out-of-sample validation shows realistic edge. Walk-forward analysis works. |
| EVIDENCE REQUIRED | `docs/audit/gate-evidence/gate-6-backtest-validated.md` exists with: (1) Backtest run on 1+ year real 15m candles. (2) OOS win rate within ±10% of IS win rate. (3) Walk-forward report. (4) Two consecutive runs with identical seed produce identical results. |
| FAIL CONDITIONS | OOS win rate deviates >10% from IS. Non-deterministic results across runs. Walk-forward fails. |
| WHO/WHAT MAY APPROVE | Human Principal Engineer + independent quantitative reviewer. |

---

GATE 7 — PAPER TRADING STABLE

| Field | Value |
|-------|-------|
| GATE ID | GATE-7 |
| ENTRY CRITERIA | GATE-6 passed. Paper trading functional with real market data (not synthetic). |
| EXIT CRITERIA | Paper trading stable over extended period. All risk checks functional. Reconciliation working. No anomalous fills. |
| EVIDENCE REQUIRED | `docs/audit/gate-evidence/gate-7-paper-stable.md` exists with: (1) Paper trading log showing 50+ trades. (2) All trades had risk checks executed. (3) Zero anomalous fills. (4) Reconciliation events logged. |
| FAIL CONDITIONS | Trade executed without risk check. Anomalous fill (price discrepancy > 2% from mid-market). Reconciliation not logging events. |
| WHO/WHAT MAY APPROVE | Human Principal Engineer. |

---

GATE 8 — OPERATIONAL STABILITY

| Field | Value |
|-------|-------|
| GATE ID | GATE-8 |
| ENTRY CRITERIA | GATE-7 passed. Paper trading stable. Secret management operational. Alerting configured. |
| EXIT CRITERIA | System stable under operational load. Health monitoring functional. Secrets rotated without downtime. Alerts fire on critical events. |
| EVIDENCE REQUIRED | `docs/audit/gate-evidence/gate-8-operational-stability.md` exists with: (1) 72h continuous paper trading log. (2) Secret rotation test without restart. (3) Alert fired on kill switch engagement. (4) Monitoring dashboard shows system health. |
| FAIL CONDITIONS | Secret rotation causes downtime. Alert not fired on kill switch. Monitoring dashboard shows critical errors. |
| WHO/WHAT MAY APPROVE | Human Principal Engineer + Human Operator. |

---

GATE 9 — MICRO-LIVE VALIDATION

| Field | Value |
|-------|-------|
| GATE ID | GATE-9 |
| ENTRY CRITERIA | GATE-8 passed. Micro-live capital < $50 equivalent. Testnet → micro-live transition plan approved. |
| EXIT CRITERIA | Micro-live trading runs for defined period. All risk checks functional. Kill switch verified from live endpoint. No unexpected fills. |
| EVIDENCE REQUIRED | `docs/audit/gate-evidence/gate-9-micro-live-validated.md` exists with: (1) Micro-live trade log (max $50 equivalent). (2) All trades had risk checks. (3) Kill switch engagement from live endpoint verified. (4) Zero unexpected fills or violations. |
| FAIL CONDITIONS | Trade executed without risk check. Kill switch not functional from live endpoint. Unexpected fill (>2% from mid-market). Capital loss > $5 equivalent. |
| WHO/WHAT MAY APPROVE | Human Principal Engineer + Human Risk Officer. |

---

GATE 10 — PRODUCTION CANDIDATE

| Field | Value |
|-------|-------|
| GATE ID | GATE-10 |
| ENTRY CRITERIA | GATE-9 passed. Micro-live stable. Deployment pipeline operational. Full health gate enforcement. |
| EXIT CRITERIA | System ready for production deployment. All P0-P1 tasks completed or in progress with clear completion criteria. All gates pass with evidence. |
| EVIDENCE REQUIRED | `docs/audit/gate-evidence/gate-10-production-candidate.md` exists with: (1) Deployment pipeline (Docker + Docker Compose) runs from `main` to `deploy`. (2) All P0 tasks have acceptance criteria met. (3) All P1 tasks have acceptance criteria met. (4) Gates 0-9 all have evidence artifacts. |
| FAIL CONDITIONS | Pipeline fails on deploy. P0 task acceptance criteria not met. P1 task acceptance criteria not met. Any gate 0-9 missing evidence. |
| WHO/WHAT MAY APPROVE | Human Principal Engineer + Human Operator. |

---

GATE 11 — FINAL AUDIT

| Field | Value |
|-------|-------|
| GATE ID | GATE-11 |
| ENTRY CRITERIA | GATE-10 passed. Production candidate. All architectural decisions APPROVED. All P0-P1 tasks have acceptance criteria met. |
| EXIT CRITERIA | Complete independent audit. All risks documented. Compliance with institutional requirements confirmed. Go/No-Go recommendation. |
| EVIDENCE REQUIRED | `docs/audit/gate-evidence/gate-11-final-audit.md` exists with: (1) Independent auditor report (name, date, findings). (2) All P0-P1 tasks acceptance criteria met. (3) Architecture decisions APPROVED with human signatures. (4) Full system compliance matrix. |
| FAIL CONDITIONS | Independent auditor finds critical issues. Any P0-P1 task acceptance criteria not met. Any architecture decision not APPROVED. |
| WHO/WHAT MAY APPROVE | Independent external auditor (institutional compliance). |

---

GATE 12 — GO / NO-GO

| Field | Value |
|-------|-------|
| GATE ID | GATE-12 |
| ENTRY CRITERIA | GATE-11 passed. Final audit complete. All evidence artifacts in place. |
| EXIT CRITERIA | VUA v1.0 release decision. Go: system cleared for production. No-Go: documented blockers, remediation required. |
| EVIDENCE REQUIRED | `docs/audit/gate-evidence/gate-12-go-no-go.md` exists with: (1) Go/No-Go decision document (who, when, why). (2) If Go: production deployment checklist completed. (3) If No-Go: blocker list + remediation plan + timeline. |
| FAIL CONDITIONS | Decision cannot be made (missing evidence). Insufficient justification for Go. No-Go with no remediation plan. |
| WHO/WHAT MAY APPROVE | VUA institutional stakeholder committee. Final sign-off authority. |

---

## Gate Dependency Order

GATE-0 → GATE-1 → GATE-2 → GATE-3 → GATE-4 → GATE-5 → GATE-6 → GATE-7 → GATE-8 → GATE-9 → GATE-10 → GATE-11 → GATE-12

**Each gate requires evidence artifacts in `docs/audit/gate-evidence/`. No bypass paths. Gate N+1 blocked until gate N evidence exists and is validated.**