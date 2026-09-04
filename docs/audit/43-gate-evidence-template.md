# Gate Evidence Template — P0-002 PostgreSQL + Prisma Runtime Validation

**Purpose:** Reusable evidence checklist for declaring a gate PASS, FAIL, or BLOCKED.
**Usage:** Fill one table per validation gate or checkpoint. Attach raw terminal/output artifacts.

---

## CHECKPOINT METADATA

| Field | Value |
|-------|-------|
| Checkpoint ID | P0-002-<profile> |
| Date | YYYY-MM-DD |
| Environment | native Linux / WSL2 / macOS |
| Node.js | `<version>` |
| npm/pnpm | `<version>` |
| Docker | `<version>` / absent |
| PostgreSQL | `<version>` |
| Prisma | `<version>` |
| Git branch | `<branch>` |
| Git commit | `<sha>` |
| Operator | `<name/role>` |
| Witness | `<name/role>` |

---

## EVIDENCE TABLE

| Category | Check | Expected | Actual | Status | Evidence Path/Notes |
|----------|-------|----------|--------|--------|---------------------|
| Environment | OS is native Linux/WSL2/macOS | Yes | | PASS / FAIL / BLOCKED | |
| Environment | Node 24/26 LTS present | Yes | | PASS / FAIL / BLOCKED | |
| Environment | npm/pnpm functional | Yes | | PASS / FAIL / BLOCKED | |
| Docker | Docker Engine running | Yes | | PASS / FAIL / BLOCKED | |
| Docker | `docker compose up -d postgres` succeeds | Yes | | PASS / FAIL / BLOCKED | |
| Docker | Container healthy (`pg_isready`) | Yes | | PASS / FAIL / BLOCKED | |
| PostgreSQL | `psql` connects with `DATABASE_URL` | Yes | | PASS / FAIL / BLOCKED | |
| PostgreSQL | Database `vua_trading` exists | Yes | | PASS / FAIL / BLOCKED | |
| Prisma | `prisma generate` completes | 0 errors | | PASS / FAIL / BLOCKED | |
| Prisma | `prisma validate` returns valid | "schema is valid" | | PASS / FAIL / BLOCKED | |
| Migration | `prisma migrate deploy` applies | All migrations applied | | PASS / FAIL / BLOCKED | |
| Migration | `prisma migrate status` clean | No pending migrations | | PASS / FAIL / BLOCKED | |
| Schema | Expected tables present | All 11 tables | | PASS / FAIL / BLOCKED | |
| Schema | Indexes present | As per schema | | PASS / FAIL / BLOCKED | |
| Schema | FK/UNIQUE constraints present | As per schema | | PASS / FAIL / BLOCKED | |
| CRUD | Create/read/update/delete on representative entities | All succeed | | PASS / FAIL / BLOCKED | |
| CRUD | `UNIQUE(client_order_id, exchange, symbol)` enforced | Rejects duplicate | | PASS / FAIL / BLOCKED | |
| Transaction | COMMIT persists data | Data survives commit | | PASS / FAIL / BLOCKED | |
| Transaction | ROLLBACK removes uncommitted data | No rows after rollback | | PASS / FAIL / BLOCKED | |
| Persistence | Data survives process restart | Data present after reconnect | | PASS / FAIL / BLOCKED | |
| Restart Recovery | PostgreSQL restart preserves data | FK integrity intact | | PASS / FAIL / BLOCKED | |
| Security | No secrets in logs/output | Verified | | PASS / FAIL / BLOCKED | |
| Security | `.env` not tracked / no credentials in repo | Verified | | PASS / FAIL / BLOCKED | |
| No-Dummy | No mock Prisma Client | Verified | | PASS / FAIL / BLOCKED | |
| No-Dummy | No synthetic DB responses | Verified | | PASS / FAIL / BLOCKED | |
| Source Safety | `prisma/schema.prisma` unchanged | SHA preserved | | PASS / FAIL / BLOCKED | |
| Source Safety | `docker-compose.yml` unchanged | Diff absent | | PASS / FAIL / BLOCKED | |
| Source Safety | `server/`, `src/` unchanged | Diff absent | | PASS / FAIL / BLOCKED | |

---

## FAILURE / BLOCKER LOG

| # | Failure | Classification | Action Required |
|---|---------|----------------|-----------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

## ARTIFACTS TO ATTACH

- [ ] Terminal logs for section 5 commands from `41-p0-002-runtime-handoff.md`
- [ ] `psql` table list output
- [ ] Prisma generate/validate logs
- [ ] Migration apply/status logs
- [ ] CRUD query results
- [ ] Transaction commit/rollback results
- [ ] Restart recovery query results
- [ ] Git status/diff summary
- [ ] Optional: `docker compose logs --tail=100 postgres`

---

## FINAL CLASSIFICATION

| Result | Criteria |
|--------|----------|
| PASS | All required checks = PASS; all artifacts attached |
| FAIL | One or more checks = FAIL with root cause identified |
| BLOCKED — ENVIRONMENT | Docker/PostgreSQL/Prisma cannot execute in current environment |
| BLOCKED — CONFIG | Schema/config error identified; fixable without architecture change |
| BLOCKED — MIGRATION | Migration error identified; fixable without architecture change |
| BLOCKED — VALIDATION | Runtime error identified during CRUD/transaction/persistence |

---

## APPROVAL

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Principal Engineer | | | |
| Reviewer | | | |

STOP.
WAIT FOR NEXT INSTRUCTION.
