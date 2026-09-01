# P0-002-B — U1 Full UUID Contract Authorization Expansion

Status: AWAITING HUMAN AUTHORIZATION FOR IMPLEMENTATION
Date: 2026-09-01
Role: Principal Engineer ONLY
Scope: PostgreSQL Profile B ONLY

---

## 1. Purpose

This document formally expands the previously authorized P0-002-B Option B / R2 decision into:

**U1 — Full UUID Contract**

It records the forensic basis, the exact intended PostgreSQL type contract, the affected models/fields, and the authorization boundary. It does **not** authorize implementation, migration, database changes, CRUD, transaction validation, or P0-003.

---

## 2. Why Option B Minimal Correction Was Insufficient

The original Option B authorization targeted only:

- `decisions.id` → `String @id @default(uuid()) @db.Uuid`
- `risk_decisions.decision_id` → `String? @unique @map("decision_id") @db.Uuid`
- Prisma 7 datasource URL removal from schema

Forensic audit of the complete model graph revealed this correction is necessary but **not sufficient**. The canonical schema contains a **systemic PK/FK type mismatch** under Prisma 7:

- Multiple foreign-key columns are explicitly annotated `@db.Uuid` → PostgreSQL `uuid`.
- The primary-key fields they reference are declared as `String @id @default(uuid())` **without** `@db.Uuid`.
- Prisma 7 maps `String @id @default(uuid())` to PostgreSQL `text` by default.
- Result: FK columns are `uuid`, referenced PKs are `text` → PostgreSQL rejects FK creation with `uuid and text are of incompatible types`.

This mismatch propagates through the model graph, causing Prisma 7 to generate broad migrations that touch unrelated tables, indexes, and timestamp metadata.

---

## 3. Complete PK/FK Type-Contract Forensic Findings

### 3.1 PK Inventory

| Model | PK Field | Prisma Declaration | Expected PG Type |
|---|---|---|---|
| system_config | id | `String @id @default(uuid())` | text |
| config_history | id | `String @id @default(uuid())` | text |
| decisions | id | `String @id @default(uuid()) @db.Uuid` | uuid |
| orders | id | `String @id @default(uuid())` | text |
| fill_events | id | `String @id @default(uuid())` | text |
| positions | id | `String @id @default(uuid())` | text |
| position_events | id | `String @id @default(uuid())` | text |
| risk_decisions | id | `String @id @default(uuid())` | text |
| reconciliation_events | id | `String @id @default(uuid())` | text |
| system_events | id | `String @id @default(uuid())` | text |
| market_data_candles | id | `BigInt @id @default(autoincrement())` | bigint |

### 3.2 FK Inventory

| Source Model | Source Field | Target Model | Target Field | Cardinality | onDelete | onUpdate |
|---|---|---|---|---|---|---|
| orders | decision_id | decisions | id | many-to-one | SetNull | Cascade |
| fill_events | order_id | orders | id | many-to-one | Restrict | Cascade |
| positions | originating_order_id | orders | id | many-to-one | Restrict | Cascade |
| position_events | position_id | positions | id | many-to-one | Restrict | Cascade |
| risk_decisions | decision_id | decisions | id | one-to-one | SetNull | Cascade |

### 3.3 PK/FK Type Contract Matrix

| Relation | FK Field | FK Prisma Type | FK DB Type | PK Field | PK Prisma Type | PK DB Type | Compatible? |
|---|---|---|---|---|---|---|---|
| orders → decisions | decision_id | `String? @db.Uuid` | uuid | id | `String @id @default(uuid()) @db.Uuid` | uuid | PASS |
| fill_events → orders | order_id | `String @db.Uuid` | uuid | id | `String @id @default(uuid())` | text | MISMATCH |
| positions → orders | originating_order_id | `String @db.Uuid` | uuid | id | `String @id @default(uuid())` | text | MISMATCH |
| position_events → positions | position_id | `String @db.Uuid` | uuid | id | `String @id @default(uuid())` | text | MISMATCH |
| risk_decisions → decisions | decision_id | `String? @db.Uuid` | uuid | id | `String @id @default(uuid()) @db.Uuid` | uuid | PASS |

### 3.4 UUID Field Inventory

| Model | Field | Role | @db.Uuid | Related Field | Related Type | Status |
|---|---|---|---|---|---|---|
| decisions | id | PK | YES | orders.decision_id, risk_decisions.decision_id | uuid | PASS |
| orders | decision_id | FK | YES | decisions.id | uuid | PASS |
| orders | id | PK | NO | fill_events.order_id, positions.originating_order_id | uuid | MISMATCH |
| fill_events | order_id | FK | YES | orders.id | text | MISMATCH |
| positions | originating_order_id | FK | YES | orders.id | text | MISMATCH |
| positions | id | PK | NO | position_events.position_id | uuid | MISMATCH |
| position_events | position_id | FK | YES | positions.id | text | MISMATCH |
| risk_decisions | decision_id | FK | YES | decisions.id | uuid | PASS |
| risk_decisions | order_id | ordinary field | YES | orders.id | text | MISMATCH |
| risk_decisions | id | PK | NO | — | — | — |

---

## 4. U1 Full UUID Contract Definition

The intended PostgreSQL type contract is:

**All UUID-like primary keys and foreign keys use PostgreSQL `uuid`.**

Specifically:

| Model | Field | Authorized PG Type |
|---|---|---|
| decisions | id | uuid |
| orders | id | uuid |
| orders | decision_id | uuid |
| fill_events | id | uuid |
| fill_events | order_id | uuid |
| positions | id | uuid |
| positions | originating_order_id | uuid |
| position_events | id | uuid |
| position_events | position_id | uuid |
| risk_decisions | id | uuid |
| risk_decisions | decision_id | uuid |
| risk_decisions | order_id | uuid |

Non-PK text/String identifiers that are **not** UUID-like remain `text` under Prisma 7 defaults.

The existing `risk_decisions.decision_id` **must retain** `@unique`, preserving the one-to-one risk-decision audit semantics.

---

## 5. Exact Models/Fields Affected

Schema changes required to implement U1:

- `orders.id`: `String @id @default(uuid())` → `String @id @default(uuid()) @db.Uuid`
- `fill_events.id`: `String @id @default(uuid())` → `String @id @default(uuid()) @db.Uuid`
- `positions.id`: `String @id @default(uuid())` → `String @id @default(uuid()) @db.Uuid`
- `position_events.id`: `String @id @default(uuid())` → `String @id @default(uuid()) @db.Uuid`
- `risk_decisions.id`: `String @id @default(uuid())` → `String @id @default(uuid()) @db.Uuid`

No other schema fields, relations, indexes, or business semantics are changed.

---

## 6. Why U1 Preserves the Intended Architecture

Evidence supporting U1 as the intended contract:

1. **Initial migration behavior:** The initial migration `20260831000000_p0_002_init` created **all** uuid-defaulted String primary keys as PostgreSQL `UUID`, including `orders.id`, `fill_events.id`, `positions.id`, etc. This indicates the original schema author intended all UUID-like identifiers to be stored as `uuid`.

2. **FK explicitness:** Every foreign-key column referencing a uuid-defaulted primary key is explicitly annotated `@db.Uuid` in the canonical schema. This pattern is too consistent to be accidental; it signals that the referenced PKs were also intended to be `uuid`.

3. **Domain semantics:** Decision IDs, order IDs, position IDs, and event IDs are UUIDs in the application domain. Storing them as PostgreSQL `uuid` preserves type safety, index performance, and semantic clarity.

4. **Option B context:** Option B was authorized to align `decisions.id` with its FK columns, implying the architecture intends UUID at that boundary. U1 generalizes this correction to the entire model graph where the same mismatch exists.

5. **SQLite neutrality:** SQLite does not enforce strict column type compatibility; `@db.Uuid` maps to `TEXT` in SQLite. Therefore U1 does not change SQLite behavior or require SQLite schema changes.

---

## 7. Why U1 Is Preferred Over Alternatives

### 7.1 Alternative A: Convert UUID FK Fields to Text

- Would require removing `@db.Uuid` from all FK columns.
- Contradicts explicit schema annotations and the initial migration's UUID semantics.
- Loses PostgreSQL-native UUID typing and index advantages.
- **Verdict:** Rejected. Abandons intended architecture.

### 7.2 Alternative B: Manual Migration Authoring

- Would bypass Prisma's migration workflow.
- Introduces maintenance burden and drift risk.
- Violates the project's documented migration strategy.
- **Verdict:** Rejected. Inappropriate for P0-002-B.

### 7.3 Alternative C: Continue with Mixed Schema

- Leaves the canonical schema internally inconsistent.
- Guarantees recurring Prisma migration failures.
- Forces every future migration to fight the same type mismatch.
- **Verdict:** Rejected. Unsustainable.

### 7.4 U1: Full UUID Contract

- Aligns canonical schema, initial migration intent, and Prisma 7 behavior.
- Produces a clean, reproducible migration history.
- Preserves all business semantics and relations.
- Keeps SQLite Profile A isolated.
- **Verdict:** Preferred. Requires expanded authorization.

---

## 8. Migration Implications

Implementing U1 will require a corrective migration that:

1. Alters the PostgreSQL column type of 6 primary-key columns from `text` to `uuid`:
   - `orders.id`
   - `fill_events.id`
   - `positions.id`
   - `position_events.id`
   - `risk_decisions.id`
   - `decisions.id` (already uuid in rebuilt DB, but must match canonical schema)

2. Ensures all existing UUID foreign-key columns remain compatible.

3. Adds the `UNIQUE` constraint on `risk_decisions.decision_id` if not already present.

4. Restores/maintains all foreign-key constraints.

Prisma 7 may generate a broad migration that also includes:

- **Consequential but necessary:** FK drops/recreates around PK type changes; PK drops/recreates on affected tables.
- **Metadata/naming:** Index name changes from initial migration naming to Prisma 7 conventions; timestamp precision normalization.
- **Unrelated:** Any proposed changes to tables not participating in the UUID contract must be reviewed and rejected if outside authorized scope.

**No migration is authorized by this document.** Any generated migration must be audited against the authorized scope before application.

---

## 9. Empty-Database Safety Assessment

The development database `vua_trading` has been verified empty:

- All 11 application tables contain `0` rows.
- No user data, no trading data, no production data exists.
- R2 rebuild has already been authorized for the empty development database.
- U1 implementation on an empty database carries **zero data-loss risk**.

U1 is authorized **only** for the verified-empty development database `vua_trading`. It must not be applied to any database containing production or test data without separate authorization and data-loss assessment.

---

## 10. SQLite Isolation

- `prisma/schema-sqlite.prisma` remains **unchanged**.
- SQLite Profile A remains **independent**.
- U1 changes apply **only** to the PostgreSQL canonical schema.
- SQLite does not enforce strict column type compatibility; `@db.Uuid` maps to `TEXT` in SQLite.
- No SQLite migration, no SQLite schema change, and no SQLite runtime change is implied by U1.

---

## 11. Explicit Authorization Boundary

This document authorizes **U1 Full UUID Contract** as the intended PostgreSQL schema direction for P0-002-B.

It does **not** authorize:

- Modification of `prisma/schema.prisma`
- Modification of `prisma/schema-sqlite.prisma`
- Modification of `server/` or `src/`
- Modification of `docker-compose.yml`
- Database teardown, recreation, or migration
- `prisma migrate dev`, `prisma migrate deploy`, or `prisma db push`
- Manual SQL execution
- CRUD, transaction, rollback, or persistence testing
- P0-003 or any downstream task
- Trader Brain, Live Trading, or Autonomous Trading activation
- GitHub commit or push

Implementation requires a **separate explicit human authorization** after this document is reviewed and approved.

---

## 12. Evidence Trail

- Forensic audit: PK/FK type-contract analysis across all 11 models.
- Live PostgreSQL catalog inspection: `information_schema.columns`, `information_schema.table_constraints`.
- Prisma diff output: `prisma migrate diff --from-empty --to-schema=./prisma/schema.prisma`.
- Failed migration evidence preserved: `docs/audit/evidence/20260901135451_p0_002_fix_risk_decisions_decision_id_unique/`.
- Initial migration evidence preserved: `docs/audit/evidence/migrations/20260831000000_p0_002_init/`.
- Previous authorization: `docs/audit/43-p0-002-b-option-b-r2-authorization.md`.

---

## 13. Documentation Impact

The following documents require updates after U1 is approved and implemented:

- `docs/audit/29-adr-002-database-review.md` — UUID contract clarification
- `docs/audit/42-p0-002-b-postgresql-pc-server-plan.md` — migration strategy update
- `docs/audit/43-p0-002-b-option-b-r2-authorization.md` — superseded by U1; add reference
- `docs/audit/22-architecture-decisions.md` — ADR-002 note update
- `docs/audit/27-vua-master-project-map.md` — P0-002-B status update

Potential new document:
- Post-implementation forensic decision record capturing final schema state, migration artifacts, and acceptance evidence.

---

## 14. Authorization Status

| Item | Status |
|------|--------|
| U1 Full UUID Contract definition | DOCUMENTED — awaiting human approval |
| Schema modification to add `@db.Uuid` | NOT AUTHORIZED |
| Migration generation/application | NOT AUTHORIZED |
| Database rebuild/reconstruction | NOT AUTHORIZED |
| CRUD / transaction / persistence validation | NOT AUTHORIZED |
| P0-003 | NOT STARTED |

**No implementation may proceed until this document receives explicit human approval.**

---

## STOP

P0-002-B = AWAITING HUMAN AUTHORIZATION FOR U1 IMPLEMENTATION

Next action: wait for explicit human authorization to modify the canonical PostgreSQL schema according to U1 and execute the authorized migration reconstruction.
