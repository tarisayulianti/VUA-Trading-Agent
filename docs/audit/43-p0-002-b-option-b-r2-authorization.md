# P0-002-B — Option B UUID Contract & R2 Rebuild Authorization

Status: AWAITING HUMAN AUTHORIZATION
Date: 2026-09-01
Role: Principal Engineer ONLY
Scope: PostgreSQL Profile B ONLY

---

## 1. Problem Statement

During P0-002-B PostgreSQL migration validation, Prisma 7.10.0 generated a corrective migration that failed at the database level with:

```
ERROR: foreign key constraint "orders_decision_id_fkey" cannot be implemented
DETAIL: Key columns "decision_id" and "id" are of incompatible types: uuid and text.
```

Forensic audit determined the root cause:

- **Canonical schema:** `decisions.id` is `String @id @default(uuid())`. Prisma 7 maps this to `text` in PostgreSQL.
- **Initial migration:** `20260831000000_p0_002_init` created `decisions.id` as `UUID`, which was compatible with FK columns.
- **Live database after initial migration:** `decisions.id` = `uuid`
- **Canonical schema FK columns:** `orders.decision_id` and `risk_decisions.decision_id` are explicitly `@db.Uuid`
- **Current divergence:** Prisma 7 now expects `decisions.id` to be `text` for `String @id`, while FK columns remain `uuid`. This makes the relation type-incompatible under Prisma 7's current mapping.

The existing `@unique` correction on `risk_decisions.decision_id` is **not** the cause of this mismatch; it is a separate, already-authorized consistency fix. The FK type mismatch must be resolved before any migration can be applied.

---

## 2. Option Analysis

### Option 1: Change FK columns to `String` (text)

- **Change:** Remove `@db.Uuid` from `orders.decision_id` and `risk_decisions.decision_id`
- **Effect:** All three columns become `text`, matching Prisma 7's current `String @id` mapping
- **Migration scope:** Alter only the two FK column types
- **Risk:** Low; minimal schema change
- **Verdict:** Viable, but abandons explicit UUID typing for foreign keys

### Option 2/B: Add `@db.Uuid` to `decisions.id` (recommended)

- **Change:** `decisions.id String @id @default(uuid()) @db.Uuid`
- **Effect:** `decisions.id` maps to `uuid` in PostgreSQL, matching the initial migration intent and FK column types
- **Migration scope:** Broad in Prisma 7's current behavior — Prisma treats changing a PK type as systemic and proposes PK rewrites, FK drops/recreates, and index renames across all tables
- **Risk:** Medium; broad migration scope, but database is empty
- **Verdict:** Recommended as the correct PostgreSQL-native contract

### Option 3: Alternative UUID-primary-key syntax

- **Investigation:** Prisma 7.10.0 accepts `String @id @default(uuid()) @db.Uuid` as valid syntax
- **Support:** Confirmed via temporary isolated schema validation
- **Verdict:** Option B uses supported syntax; no alternative needed

---

## 3. Decision

**Option B is the recommended PostgreSQL schema contract.**

Rationale:
- Restores the original intended native PostgreSQL contract: `decisions.id = UUID`
- Makes FK columns `orders.decision_id` and `risk_decisions.decision_id` type-compatible without changing them
- Aligns with the initial migration's original intent
- Keeps explicit UUID typing for primary and foreign keys
- SQLite Profile A is unaffected because SQLite does not enforce strict column type compatibility

**Final implementation requires explicit human authorization.** This document records the recommended path; no schema or database changes are authorized yet.

---

## 4. Recovery Strategy: R2 — Rebuild Empty Development Database

### Why R2

- The development database `vua_trading` is **completely empty** — no application data, no orders, no decisions, no fills
- Failed corrective migration `20260901135451_p0_002_fix_risk_decisions_decision_id_unique` exists in migration history as a failed/failed-to-apply record
- In-place repair would require: cleaning failed migration history, applying multiple corrective migrations, and managing broad index/FK rebuilds
- Rebuild is safer, cleaner, and ensures reproducible migration history

### Why Not R1 (In-Place Repair)

- Requires partial migration history cleanup
- Must reconcile dropped foreign keys from failed migration
- Higher complexity for empty database with no data to preserve
- Risk of hidden drift if repair is incomplete

### Safety Boundary

R2 is authorized **only** for the development database `vua_trading` that has been verified empty. It must NOT be applied to any database containing production or test data without explicit separate authorization and data-loss assessment.

---

## 5. Migration Recovery Plan

```
AUTHORIZE Option B + R2
    ↓
Modify canonical schema: decisions.id → String @id @default(uuid()) @db.Uuid
    ↓
Verify Prisma 7 schema validation passes
    ↓
Clean/rebuild empty development PostgreSQL database vua_trading
    ↓
Apply clean initial migration: 20260831000000_p0_002_init
    ↓
Create corrective migration: risk_decisions.decision_id UNIQUE
    ↓
Apply corrective migration
    ↓
Verify PK/FK/UNIQUE constraints in live database
    ↓
Verify persistence/container restart
    ↓
Proceed to CRUD validation
    ↓
Proceed to transaction + rollback validation
```

### Failed Migration Handling

The failed migration `20260901135451_p0_002_fix_risk_decisions_decision_id_unique` must remain in migration history as evidence of the failure until recovery is performed officially. Do not delete or alter it manually.

---

## 6. Acceptance Criteria

The following must be evidence-backed after implementation:

- [ ] AC-UUID-1: `decisions.id` in PostgreSQL is type `uuid`
- [ ] AC-UUID-2: `orders.decision_id` is type-compatible with `decisions.id`
- [ ] AC-UUID-3: `risk_decisions.decision_id` is type-compatible with `decisions.id`
- [ ] AC-UUID-4: All foreign keys involving `decisions.id` are valid
- [ ] AC-UUID-5: `risk_decisions.decision_id` has UNIQUE constraint
- [ ] AC-UUID-6: Migration history is clean and reproducible
- [ ] AC-UUID-7: No data loss (database was empty)
- [ ] AC-UUID-8: Prisma schema validation passes
- [ ] AC-UUID-9: `prisma migrate status` shows database up to date
- [ ] AC-UUID-10: SQLite Profile A remains unchanged and valid

---

## 7. Authorization Status

| Item | Status |
|------|--------|
| Option B schema change | Documented — original minimal scope |
| R2 rebuild strategy | Documented — original minimal scope |
| U1 Full UUID Contract | Documented in `docs/audit/44-p0-002-b-u1-full-uuid-contract-authorization.md`; **requires separate explicit human authorization** |
| Canonical schema modification | NOT STARTED |
| Database rebuild | NOT STARTED |
| Corrective migration | NOT STARTED |
| CRUD validation | NOT STARTED |

**No implementation may proceed until U1 receives explicit human approval.** The original Option B authorization remains valid as historical evidence, but U1 supersedes it as the current recommended implementation scope.

---

## 8. Evidence Trail

- Initial migration: `prisma/migrations/20260831000000_p0_002_init/migration.sql`
- Failed corrective migration: `prisma/migrations/20260901135451_p0_002_fix_risk_decisions_decision_id_unique/migration.sql`
- Prisma validation output: documented in session history
- PostgreSQL catalog audit: `information_schema.columns` confirms current type state
- Temporary schema validation: `tmp-option-b-schema.prisma` validated successfully, then deleted
- U1 forensic analysis: `docs/audit/44-p0-002-b-u1-full-uuid-contract-authorization.md`
