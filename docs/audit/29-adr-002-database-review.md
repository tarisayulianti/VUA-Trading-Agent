# ADR-002 — DATABASE / PERSISTENCE ARCHITECTURE
## REVISED — DUAL-PROFILE DATABASE ARCHITECTURE

**ADR ID:** ADR-002
**Topic:** Database / Persistence Architecture
**Date (original):** 2026-08-31
**Date (revised):** 2026-09-01
**Status:** APPROVED — Dual-Profile Architecture
**Depends on:** ADR-001 (APPROVED — Hybrid TypeScript + Optional Python Worker)
**Role:** Principal Engineer ONLY
**Trader Brain:** DISABLED
**Implementation:** NOT YET STARTED — design direction approved; implementation tasks deferred

---

## REVISION HISTORY

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-08-31 | Original — PostgreSQL 16 only |
| 2.0 | 2026-09-01 | Dual-profile architecture — Android/SQLite + Server/PostgreSQL 16 |

### Why This Revision

The original ADR-002 assumed PostgreSQL 16 as the single database profile. Four exhaustive environment-recovery attempts confirmed that PostgreSQL 16 **cannot** run inside the Android/Termux/Ubuntu PRoot environment:

| Attempt | Method | Result |
|---------|--------|--------|
| 1 | uDocker pull `postgres:16-alpine` | Hangs/times out — transfer layer broken |
| 2 | Native Ubuntu apt (`postgresql-16`) | Package absent — Ubuntu 26.04 ports repo only carries 18 |
| 3 | PGDG apt (`resolute-pgdg`) | 16.15 available but dependency chain broken in PRoot (locales/libicu78/libpq5 conflict) |
| 4 | Pre-existing binary/container | None found; existing uDocker container (`77eefc09`) is empty alpine root |

**Resolution:** Dual-profile architecture — one VUA system, two deployment profiles.

---

## STEP 1 — CURRENT PERSISTENCE STATE (OBSERVED — NOT INFERRED)

Inspecting actual repository for persistence mechanisms (from direct file reads):

### In-Memory (All State — No DB)

| Component | File | Persistence Type | Evidence |
|-----------|------|------------------|----------|
| Execution state | `executionEngine.ts` | In-memory arrays (`orders`, `positions`, `closedTrades`) | Lines 14-20; lost on restart |
| Risk config | `riskEngine.ts` | In-memory `config` object | Line 11-20; lost on restart |
| Memory/equity | `memoryLedger.ts` | In-memory `equityUsd`, `highWaterMark`, `dailyStartEquity` | Lines 7-15; seeded with fake data (line 135-143) |
| Multi-agent debates | `multiAgentBrain.ts` | Returns debate objects to caller only | No persistence mechanism |
| Gemini client | `geminiClient.ts` | In-memory `state` (client, apiKey, status) | Lines 14-21 |
| Research lab | `researchLab.ts` | In-memory `latestPostMortem`; synthetic backtests | Lines 16-44 |
| API state | `server/routes/api.ts` | Module-level variables (`selectedExchange`, `engineRunning`, `autoTradingEnabled`, etc.) | Lines 23-30; lost on restart |
| SSE clients | `api.ts` | `sseClients: Response[]` array | Line 31; lost on restart |
| Exchange clients | `binance.ts` / `bybit.ts` | No persistence; fetch-only + synthetic fallback | Lines 149-229 (synthetic fallback visible) |

### What Exists: Zero Persistence

- **No PostgreSQL instance** (confirmed — no DB directory, no connection strings, no migrations applied)
- **No SQLite file** (confirmed — no `.db`, `.sqlite` files)
- **No database runtime** in current environment (uDocker pull blocked, native PG16 unavailable, PGDG dep conflict)
- **No JSON/CSV data files** (confirmed — only static source/config)
- **No Redis/cache** (confirmed — no Redis config, no cache layer)
- **No log file persistence** (only console.log, no log rotation or storage)
- **No audit trail** (risk decisions in memory only)
- **No historical data store** (backtests use synthetic candles from `generateSyntheticCandles()`)
- **No event log** (no event sourcing, no append-only records)

---

## STEP 2 — SUPPORTED DATABASE PROFILES

### PROFILE A — LOCAL / ANDROID

| Field | Value |
|-------|-------|
| **Profile ID** | PROFILE-A |
| **Profile Name** | Local / Android |
| **Target Environment** | Android / Termux / Ubuntu PRoot |
| **Database** | SQLite 3 |
| **ORM** | Prisma (provider: `sqlite`) |
| **Intended Use** | Single-device development and runtime |
| **Concurrency** | Single process only |
| **Persistence Scope** | Device-local only |
| **Production Deployment** | NOT APPROVED |

**When to use Profile A:**
- Development on Android/Termux device
- Local testing without a server
- When PostgreSQL is unavailable in the deployment environment
- Single-user, single-device scenarios

### PROFILE B — SERVER / PRODUCTION

| Field | Value |
|-------|-------|
| **Profile ID** | PROFILE-B |
| **Profile Name** | Server / Production |
| **Target Environment** | PC / Server / Production Host |
| **Database** | PostgreSQL 16 |
| **ORM** | Prisma (provider: `postgresql`) |
| **Intended Use** | Production persistence, multi-process/server workloads |
| **Concurrency** | Full concurrent write support |
| **Persistence Scope** | Server-managed |
| **Development Deployment** | APPROVED (Docker Compose) |

**When to use Profile B:**
- Production server deployment
- Multi-user environments
- Environments with Docker capability
- When full PostgreSQL ACID guarantees are required

### Relationship Between Profiles

```
VUA System
├── Profile A: Android / Termux / PRoot
│   └── SQLite (Prisma SQLite provider)
│
└── Profile B: Server / Production
    └── PostgreSQL 16 (Prisma PostgreSQL provider)
```

**CRITICAL:** SQLite is NOT a drop-in replacement for PostgreSQL. Profile A and Profile B are **separate deployment targets**, not interchangeable at runtime. The application code must NOT attempt to switch between providers dynamically — deployment profile is determined at install time.

---

## STEP 3 — SOURCE OF TRUTH

> **Exchange is the authoritative source for externally executed account state (fills, position counts, prices). Database is authoritative for orders, risk decisions, and immutable audit. In-memory is ephemeral cache only. Reconciliation is the mechanism for detecting and resolving discrepancies.**

This authority model is **UNCHANGED** from the original ADR-002 and applies to **both database profiles**.

### State Type Authority Matrix

| State | Authority | Persistence | Reconciliation Behavior |
|-------|-----------|-------------|------------------------|
| **DESIRED** — intended trade (AI/CIO proposal) | N/A — advisory only | `decisions` table (audit) | Not reconciled; no execution authority |
| **SUBMITTED** — order written to DB | DB authoritative (VUA `client_order_id`) | `orders` + `order_events` | If DB missing after crash: query exchange by `client_order_id`, insert if found |
| **OBSERVED** — fill / position on exchange | Exchange authoritative (price, qty, fills) | `fill_events` (appended from exchange) | Fill conflict: exchange wins, DB corrected via reconciliation event |
| **PERSISTED** — audit / history | DB authoritative (append-only events) | `risk_decisions`, `position_events`, `reconciliation_events`, `system_events` | Never overwritten; discrepancies produce NEW reconciliation event |
| **RECONCILED** — current operational state | Derived from DB + Exchange | `positions` (current state) | Discrepancy → event first, correction after, operator alert |

### Conflict Resolution Hierarchy

1. **Fill events:** Exchange authoritative (price/quantity at execution time)
2. **Open positions:** Exchange authoritative for existence/quantity; DB authoritative for historical context
3. **Risk veto decisions:** DB authoritative (audit must not be changed by exchange data)
4. **Order submissions:** DB authoritative (order IDs assigned by VUA)
5. **Equity / balance:** DB reconstructed from DB trades; exchange only validates

### Reconciliation Algorithm

```
For each open position:
  1. Read DB position state + fill_events
  2. Query exchange position state (testnet/live)
  3. Compare: symbol, side, quantity, entry price, leverage
  4. If DB ≠ Exchange:
     - Write reconciliation_event (immutable — append-only)
     - If exchange has position, DB missing → insert from exchange data
     - If DB has position, exchange missing → examine (possibly filled/closed)
     - If both exist with different quantity/size → correction + operator alert
  5. Update memory state from reconciled DB
  6. No historical events are ever modified or deleted
```

---

## STEP 4 — ORM / DATA ACCESS CONTRACT

### Prisma Multi-Provider Strategy

**Goal:** ONE Prisma schema, two provider targets, zero application-level branching on provider type.

**Implementation approach:**

```prisma
// schema.prisma — canonical schema
// Profile A: build with provider = "sqlite"
// Profile B: build with provider = "postgresql"
```

**Prisma Client generation:**
- Profile A: `prisma generate --no-engine` (SQLite uses no native engine in dev)
- Profile B: `prisma generate` (PostgreSQL native engine)

### DATABASE_URL Strategy

```bash
# Profile A (SQLite)
DATABASE_URL="file:./data/vua_dev.db"
DATABASE_PROFILE="sqlite"  # or detected from DATABASE_URL scheme

# Profile B (PostgreSQL)
DATABASE_URL="postgresql://postgres:password@localhost:5432/vua_trading"
DATABASE_PROFILE="postgresql"  # or detected from DATABASE_URL scheme
```

**Runtime detection:** Prisma Client reads `DATABASE_URL` at startup. The application does NOT inspect provider type — Prisma handles dialect differences internally.

### Schema Compatibility Requirements

The canonical Prisma schema **MUST** be compatible with both SQLite and PostgreSQL providers. This imposes the following constraints:

#### Compatible (works on both)

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| String / Text | ✓ | ✓ |
| Int / BigInt | ✓ | ✓ |
| Float / Decimal | ✓ | ✓ |
| Boolean | ✓ | ✓ |
| DateTime | ✓ | ✓ |
| UUID | ✓ (via extension) | ✓ (native) |
| JSON (stored as text) | ✓ (SQLite JSON functions) | ✓ (JSONB) |
| ENUM (stored as string) | ✓ (via String + validation) | ✓ (native) |
| Default values (scalar) | ✓ | ✓ |
| Primary keys (UUID, auto) | ✓ | ✓ |
| Indexes | ✓ | ✓ |
| Foreign keys | ✓ | ✓ |
| Many-to-many relations | ✓ | ✓ |
| Unique constraints | ✓ | ✓ |

#### Incompatible / Provider-Specific

| Feature | SQLite | PostgreSQL | Resolution |
|---------|--------|------------|------------|
| `Decimal` type | Approximated (no exact decimal) | Exact via NUMERIC | Use `Decimal` Prisma type; cast at read time |
| `Unsupported` annotations | Not supported | Supported | Avoid PostgreSQL-specific types |
| `cockroachdb` provider | N/A | N/A | Not used |
| `Array` type | Not natively supported | Supported | Store as JSON string |
| `Bit` / `ByteA` | Supported differently | Supported differently | Use `Bytes` with appropriate mapping |
| ` pg-extension` features | N/A | e.g., `uuid-ossp` | Avoid unless Profile-B only |
| Transaction isolation levels | Limited (`IMMEDIATE`/`EXCLUSIVE`) | Full serializable | Design transactions for SQLite's weakest level |
| Full-text search | FTS5 (SQLite-specific) | `tsvector` | Use app-level search or provider-conditional query |
| `RETURNING` clause | Limited | Full | Use `select` after insert instead |
| `ON CONFLICT` (upsert) | `INSERT OR REPLACE` | `ON CONFLICT DO UPDATE` | Use Prisma upsert (handled by adapter) |
| Connection pooling | None (single file lock) | Required (`pgBouncer`/`Prisma Data Proxy`) | Profile A: single connection; Profile B: pool |

#### Schema Rules for Dual-Provider Compatibility

1. **No `@db.Text`, `@db.Integer` etc.** — use generic Prisma types only
2. **No PostgreSQL-specific `@default(dbgenerated(...))`** — use portable defaults
3. **No `cockroachdb` or other non-standard providers**
4. **Decimal precision** — accept that SQLite uses floating-point approximation; do not rely on sub-decimal precision for financial calculations
5. **No `CREATE EXTENSION`** in migrations unless wrapped in provider-conditional SQL
6. **No `UNIQUE` index using `USING hash`** — omit index method (let provider decide)

### Migration Strategy

| Profile | Migration Command | Notes |
|---------|-------------------|-------|
| Profile A (SQLite) | `prisma migrate dev` with SQLite provider | Creates `.db` file; migrations via SQLITE migrations |
| Profile B (PostgreSQL) | `prisma migrate deploy` with PostgreSQL provider | Docker-based production; applies via `npx prisma migrate deploy` |

**Canonical migration:** The `prisma/migrations/` directory is **shared** between profiles. Only schema-compatible migrations are acceptable. Provider-specific migration SQL must be wrapped in conditional blocks.

**Migration file naming convention:** `YYYYMMDDHHMMSS_profile_name.sql`

### Transaction Semantics

| Aspect | Profile A (SQLite) | Profile B (PostgreSQL) |
|--------|--------------------|-----------------------|
| ACID guarantees | Full for single connection | Full with full isolation levels |
| Default isolation | `SERIALIZABLE` (SQLite) | `READ COMMITTED` (PostgreSQL default) |
| Write concurrency | Single writer (file lock) | Full concurrent writers |
| Transaction timeout | No explicit timeout (relies on OS) | `idle_in_transaction_session_timeout` configurable |
| Savepoints | Supported | Supported |
| advisory locks | Not available | Available |
| LISTEN/NOTIFY | Not available | Available (for real-time events) |

**Design implication:** VUA transactions must be **short and atomic** to work well on both providers. No long-running transactions.

### Concurrency Implications

| Aspect | Profile A (SQLite) | Profile B (PostgreSQL) |
|--------|--------------------|-----------------------|
| Reader concurrency | Unlimited reads | MVCC (snapshot isolation) |
| Writer concurrency | Single writer (EXCLUSIVE lock) | Full concurrent writes |
| Connection limit | 1 writer | Configurable (default 100) |
| Read replicas | Not available | Available |
| Failover | Not available | Available (with connection pooler) |

**Profile A limitation:** Only ONE write can occur at a time. On Android, this is acceptable (single process). On server, use Profile B for concurrent trading engines.

### Locking Implications

| Scenario | Profile A | Profile B |
|---------|-----------|-----------|
| Two simultaneous writes | Second blocked until first commits | Both proceed with row locks |
| Long-running transaction | Blocks all writers | Only blocks conflicting rows |
| Connection exhaustion | N/A (single file) | Pool exhaustion → queuing |

### Indexing Differences

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Index types | B-tree (default), R-tree, FTS5 | B-tree, Hash, GIN, GiST, BRIN |
| Partial indexes | Supported | Supported |
| Expression indexes | Supported | Supported |
| Covering indexes | SQLite-specific optimization | PostgreSQL can use covering indexes |
| `INCLUDE` columns | Not a separate concept | Supported (INCLUDE in B-tree) |

**Recommendation:** Use only B-tree indexes (default) to ensure portability.

### Data Type Differences

| Prisma Type | SQLite storage | PostgreSQL storage |
|-------------|----------------|--------------------|
| `String` | TEXT | VARCHAR(n) or TEXT |
| `Int` | INTEGER | INTEGER |
| `BigInt` | INTEGER (64-bit) | BIGINT |
| `Float` | REAL (IEEE 754) | DOUBLE PRECISION |
| `Decimal` | REAL (no exact decimal) | NUMERIC (exact) |
| `Boolean` | INTEGER (0/1) | BOOLEAN |
| `DateTime` | TEXT (ISO 8601) | TIMESTAMPTZ |
| `Json` | TEXT (JSON string) | JSONB |
| `Bytes` | BLOB | BYTEA |
| `Uuid` | TEXT | UUID |

**Decimal precision note:** For financial calculations (position size, PnL, equity), Profile A uses floating-point approximation. Use `Decimal.js` or similar at the application layer for precise calculations, and round to 8 decimal places before storing.

### Timestamp Behavior

| Aspect | Profile A | Profile B |
|--------|-----------|-----------|
| Timezone | Local / UTC stored as string | TIMESTAMPTZ (UTC stored) |
| Precision | Seconds (default) | Microseconds |
| NOW() | `datetime('now')` | `NOW()` |
| Timezone conversion | Application layer | Database level |

**Recommendation:** Always store and transmit timestamps as UTC. Convert to local time in the application layer.

### Foreign Key Behavior

| Aspect | Profile A (SQLite) | Profile B (PostgreSQL) |
|--------|--------------------|-----------------------|
| FK enforcement | OFF by default; enable via `PRAGMA foreign_keys = ON` | ON by default |
| FK on UPDATE/DELETE | Supported (all actions) | Supported (all actions) |
| Self-referential FK | Supported | Supported |
| Circular FK | Not recommended | Supported with deferred constraints |

**Prisma schema note:** Prisma manages FK behavior through its adapter. Always use `relationMode` in schema for SQLite to avoid Prisma's reliance on `FOREIGN_KEY_CONSTRAINTS`.

```prisma
// For SQLite compatibility:
model Order {
  id        String   @id @default(uuid())
  fills     Fill[]
  // ...
}

// In schema.prisma (SQLite profile), add:
generator client {
  provider        = "prisma-client-js"
  // relationMode = "prisma" // Not needed with recent Prisma versions
}
```

### JSON/Data-Type Differences

| Aspect | Profile A | Profile B |
|--------|-----------|-----------|
| JSON storage | TEXT column | JSONB column |
| JSON validation | None (raw text) | Schema validation available |
| JSON path queries | String matching | Full JSONPath support |
| JSON indexing | Not available | GIN index on JSONB |

**Recommendation:** Keep JSON fields small and primarily for read-only structured data (e.g., array of check results). Use typed columns for queryable fields.

### Numeric/Decimal Handling

| Aspect | Profile A (SQLite) | Profile B (PostgreSQL) |
|--------|--------------------|-----------------------|
| DECIMAL storage | Approximated (IEEE 754 double) | Exact via NUMERIC |
| Precision guaranteed | NO (floating-point) | YES (NUMERIC) |
| Rounding error | Possible | None |

**VUA-specific implications:**
- `position_size_usd`, `entry_price`, `liquidation_price` stored as Decimal/String
- Application layer (TypeScript) performs precise math using `decimal.js`
- Rounds to 8 decimal places before DB storage
- Profile B uses NUMERIC(20,8) for full precision
- Profile A uses REAL — accept ±0.00000001 rounding for local dev only

---

## STEP 5 — TRADING STATE MODEL (LIFECYCLE PERSISTENCE)

Identical to original ADR-002. Dual-database profiles do not change the trading lifecycle model.

### Signal → Decision → Execution → Reconciliation

```
SIGNAL (Market Perception)
  → Perceived from market data (DB candles + ticker)
  → NOT persisted as separate event (derived from data)

DECISION (Multi-Agent Debate → CIO Verdict)
  → Persisted to DB: debates table (full deliberation)
  → Persisted to DB: decision table (final verdict + hypothesis)
  → Event ID assigned at decision time

RISK VALIDATION (Risk Engine — Hard Veto)
  → Input: hypothesis + current equity + open positions + ticker
  → Output: approved (boolean) + veto_reason + checks_passed + recommended_size + recommended_leverage
  → PERSISTED: Every risk check result — immutable
  → If veto: no order submitted; veto event recorded

ORDER REQUEST (Execution Engine)
  → If approved: create order record (DB orders table)
  → Order ID = VUA-generated (not exchange)
  → Client order ID = VUA order ID (for idempotency)
  → Status = SUBMITTED (initial)
  → Persisted: order + all fields

ORDER SUBMISSION (Exchange Adapter)
  → Exchange may assign its own order ID
  → DB: update order with exchange_order_id (if provided)
  → DB: update status to ACKNOWLEDGED (on acknowledgment)
  → DB: if acknowledgment lost — retry with same client_order_id (idempotency)
  → Event: order_submitted

ACKNOWLEDGEMENT / PARTIAL FILL / FULL FILL
  → DB: fill_events table (append-only)
  → DB: orders table (update status, filled_qty, avg_price)
  → DB: positions table (update current_price, unrealized_pnl, update if fill triggers SL/TP)
  → DB: if partial fill → position partially updated; order partially filled

POSITION UPDATE
  → DB: positions updated (current_price from ticker + fill info)
  → DB: if SL or TP triggered → position event + close event
  → DB: reconstructed equity = initial + sum(closed_trades) + sum(open_unrealized)

RECONCILIATION (Periodic / Every Tick)
  → DB: reconciliation_events (append-only)
  → DB: corrections applied if discrepancy found
  → Memory state rebuilt from DB after reconciliation
```

---

## STEP 6 — EVENT LOG (APPEND-ONLY)

Identical to original ADR-002. Applies to both database profiles.

> **Audit logs must be append-only. They must never be updated or deleted.**

### Event Types (Required)

| Event Type | Table / Source | Immutable | Ordering |
|------------|---------------|-----------|----------|
| **Order submitted** | `order_events` | Yes | Time-based + sequence |
| **Order acknowledged** | `order_events` | Yes | Time-based |
| **Order filled (partial)** | `fill_events` | Yes | Fill sequence |
| **Order filled (full)** | `fill_events` + `close_events` | Yes | Close sequence |
| **Position opened** | `position_events` | Yes | Open sequence |
| **Position updated (price)** | `position_events` | Status updates OK; event record yes | Tick-based |
| **Position SL triggered** | `position_events` + `fill_events` | Yes | Trigger sequence |
| **Position TP triggered** | `position_events` + `fill_events` | Yes | Trigger sequence |
| **Risk veto** | `risk_decisions` | Yes — NEVER OVERWRITTEN | Veto sequence |
| **Risk approval** | `risk_decisions` | Yes — NEVER OVERWRITTEN | Approval sequence |
| **AI proposal / debate** | `debates` + `ai_proposals` | Yes | Debate sequence |
| **Configuration change** | `config_history` | Yes | Change sequence |
| **Reconciliation event** | `reconciliation_events` | Yes | Reconcile sequence |
| **Kill switch engaged** | `system_events` | Yes | System event sequence |
| **Circuit breaker trip** | `system_events` | Yes | System event sequence |
| **System error / failure** | `system_events` + `error_events` | Yes | Error sequence |

---

## STEP 7 — IDEMPOTENCY

Identical to original ADR-002. Applies to both database profiles.

> A trading system without idempotency will duplicate orders, duplicate fills, and corrupt position state.

### Design Elements

| Protection | Implementation | Justification |
|------------|---------------|---------------|
| **Client Order ID** | VUA generates `client_order_id` = `order.id`. Exchange uses this for idempotency. | Prevents duplicate submission on retry |
| **Idempotency Key** | Every `POST /api/trade/execute` includes `idempotency_key` (UUID). DB unique constraint on `(idempotency_key, exchange, symbol, side)`. | Prevents duplicate execution if client retries |
| **Unique Constraint** | `orders` table: `UNIQUE(client_order_id, exchange, symbol)` | Prevents duplicate orders with same external ID |
| **Order Event Sequence** | `order_events` has `sequence_number` per order | Replay events in correct order |
| **Fill Sequence** | `fill_events` has `fill_sequence` per order | Partial fills ordered correctly |
| **Replay Behavior** | If process restarts, replay all events from DB for open positions; rebuild from event log | Recovery without data loss |
| **Network Timeout** | If acknowledgment lost, retry with same `client_order_id`. Exchange rejects if already processed. | Idempotent retry |
| **WebSocket Overlap** | WebSocket and REST both write to DB — DB transaction prevents duplication | ACID transactions |

### Idempotency Rules

```
Rule 1: Same client_order_id = same order. Exchange must return same result.
Rule 2: If DB has fill for order = order fully filled; do not re-submit.
Rule 3: If process restarts mid-order: query DB first; reconstruct from DB + events.
Rule 4: If exchange reports same fill twice: DB unique constraint on fill_sequence prevents duplication.
Rule 5: If order canceled but DB not updated: reconciliation detects; DB corrected.
```

---

## STEP 8 — FAILURE & RECOVERY

Identical to original ADR-002 with additional Profile-A-specific notes.

| Scenario | Profile A Behavior | Profile B Behavior | Notes |
|----------|--------------------|--------------------|-------|
| VUA crashes | Restart; replay DB events; rebuild positions | Same | Both profiles support replay |
| DB corruption | Restore from last backup; replay WAL | pg_dump restore | Profile A: copy .db file; Profile B: pg_restore |
| DB locked (Profile A) | OS-level file lock; wait or fail with clear error | N/A | Profile A single-writer constraint |
| Write failure (Profile A) | `SQLITE_BUSY` → retry with backoff; alert after 3 failures | N/A | Profile A only |
| Connection loss (Profile B) | N/A | Reconnect via pool; retry transaction | Profile B only |
| Exchange disconnects | Paper continues; live stops (same as original) | Same | No change |

**Profile A specific safety rules:**
- SQLite file lock must be respected — never open DB from two processes simultaneously
- Use `PRAGMA journal_mode=WAL` for better concurrency on read-heavy workloads
- Set `PRAGMA synchronous=FULL` to ensure durability (at cost of write speed)
- Accept that under Android under heavy memory pressure, the DB file may be corrupted — have backup strategy

---

## STEP 9 — DATA MODEL AUDIT

### Entity Preservation (Both Profiles)

The original 11-entity schema is preserved identically. Both SQLite and PostgreSQL can represent:

| Entity | Profile A (SQLite) | Profile B (PostgreSQL) | Compatible |
|--------|-------------------|------------------------|------------|
| ORDERS | ✓ | ✓ | ✓ |
| FILL_EVENTS | ✓ | ✓ | ✓ |
| POSITIONS | ✓ | ✓ | ✓ |
| POSITION_EVENTS | ✓ | ✓ | ✓ |
| RISK_DECISIONS | ✓ | ✓ | ✓ |
| DECISIONS | ✓ | ✓ | ✓ |
| RECONCILIATION_EVENTS | ✓ | ✓ | ✓ |
| SYSTEM_EVENTS | ✓ | ✓ | ✓ |
| CONFIG_HISTORY | ✓ | ✓ | ✓ |
| MARKET_DATA_CANDLES | ✓ | ✓ | ✓ (performance warning for Profile A) |
| ACCOUNTS | ✓ | ✓ | ✓ |

### ORDER → FILL (0..N) Relationship

**PRESERVED.** This is the approved model. Do NOT introduce ORDER → POSITION (1:1) as a replacement. Both profiles enforce this correctly.

### Additional Profile-A Data Model Notes

- WAL mode for better write concurrency on reads
- `PRAGMA foreign_keys = ON` required (disabled by default in SQLite)
- `PRAGMA journal_mode = WAL` recommended for Profile A
- `PRAGMA synchronous = FULL` recommended for Profile A (durability over speed)

---

## STEP 10 — SQLITE LIMITATION POLICY

> **SQLite is NOT equivalent to PostgreSQL. Profile A is LOCAL/SINGLE-DEVICE. It is NOT a production database.**

### Operational Boundaries for Profile A

| Scenario | Profile A Behavior | Acceptable |
|----------|--------------------|------------|
| Multi-node deployment | NOT SUPPORTED — single file DB | ✗ |
| High-concurrency writes | NOT SUPPORTED — single writer | ✗ |
| Concurrent reads from multiple processes | Limited (1 reader blocks WAL writer) | △ |
| Distributed database | NOT SUPPORTED | ✗ |
| Automated failover | NOT AVAILABLE | ✗ |
| Point-in-time recovery | Manual (copy .db file) | △ |
| Streaming replication | NOT AVAILABLE | ✗ |
| Connection from multiple hosts | NOT SUPPORTED (file on single device) | ✗ |
| Production trading server | NOT APPROVED for Profile A | ✗ |
| Android local dev/testing | APPROVED for Profile A | ✓ |
| Single-process paper trading | APPROVED for Profile A | ✓ |
| Local persistence for learning | APPROVED for Profile A | ✓ |

### When SQLite Becomes Unavailable or Locked

**Default safety behavior:**

1. **SAFE:** VUA enters safe mode — stops trading, preserves in-memory state
2. **PAUSE:** No new orders, no position updates from trading logic
3. **RECOVER:** Log error, attempt DB reconnect with exponential backoff
4. **ALERT:** Send notification to operator

**Never:**
- `TRADE ANYWAY` when DB is unavailable
- Ignore `SQLITE_BUSY` or lock errors silently
- Continue trading with stale in-memory state

### SQLite WAL Mode Implications

- WAL mode allows one writer AND multiple concurrent readers
- Checkpoint happens automatically or on demand
- WAL file grows if not checkpointed — monitor and periodically checkpoint
- Under Android low-storage conditions, WAL can accumulate — set `PRAGMA wal_autocheckpoint=1000`

---

## STEP 11 — POSTGRESQL 16 POLICY

**UNCHANGED from original ADR-002.**

PostgreSQL 16 remains the canonical **SERVER / PRODUCTION** database profile.

- Do NOT downgrade the production database specification because Android cannot run PostgreSQL 16
- Profile A (SQLite) is a **local development profile**, not a production replacement
- Profile B (PostgreSQL 16) remains the only **production-approved** database profile
- The Android PostgreSQL blocker is reclassified as:

> **ENVIRONMENT / DEPLOYMENT PROFILE LIMITATION — NOT an architecture failure**

---

## STEP 12 — BACKUP / RECOVERY

### Profile A (SQLite) — Backup / Recovery

**Backup procedure:**

```bash
# Safe copy procedure (VUA must NOT be writing during backup)
# 1. Use VACUUM to compact before backup
# 2. Copy the .db file and WAL (if using WAL mode)
cp ./data/vua_dev.db ./data/backup/vua_dev_$(date +%Y%m%d_%H%M%S).db
cp ./data/vua_dev.db-wal ./data/backup/vua_dev_$(date +%Y%m%d_%H%M%S).db-wal

# Or use sqlite3 backup command:
sqlite3 ./data/vua_dev.db ".backup './data/backup/vua_dev_$(date +%Y%m%d).db'"
```

**Restore procedure:**

```bash
# Stop VUA
# Copy backup to data directory
cp ./data/backup/vua_dev_YYYYMMDD.db ./data/vua_dev.db
# If WAL mode: also restore WAL file
# Start VUA
```

**Corruption handling:**
- Detect corruption: `PRAGMA integrity_check;`
- If corrupted: restore from last known-good backup
- If no backup: data is lost — this is why backups are mandatory for Profile A

**WAL/locking considerations:**
- WAL file must be included in backup for full durability
- If VUA crashes while writing: WAL replay recovers to consistent state
- If both .db and WAL corrupted: data loss — backups are the only protection

### Profile B (PostgreSQL) — Backup / Recovery

**Backup procedure:**

```bash
# pg_dump (logical backup — includes schema and data)
pg_dump -U postgres -d vua_trading > backup_$(date +%Y%m%d_%H%M%S).sql

# pg_basebackup (physical backup — full cluster)
pg_basebackup -U replication -D /backup/base -Ft -z -P
```

**Restore procedure:**

```bash
# pg_dump restore
psql -U postgres -d vua_trading < backup_YYYYMMDD_HHMMSS.sql

# pg_basebackup restore
pg_restore -d vua_trading ./backup/base.tar.gzd
```

**Migration version tracking:**
- Prisma `_prisma_migrations` table tracks applied migrations
- Verify: `npx prisma migrate status`
- After restore: run `npx prisma migrate deploy` to ensure migrations are consistent

**Recovery validation:**
1. Restore backup to fresh database
2. Run `npx prisma migrate status` — all migrations should be applied
3. Query each table — confirm row counts match expected
4. Run smoke query: `SELECT 1`

---

## STEP 13 — ACCEPTANCE CRITERIA

### Profile A (SQLite Android) — Acceptance Gate

| # | Criterion | Validation Method |
|---|-----------|------------------|
| A1 | SQLite runtime available | `sqlite3 --version` succeeds |
| A2 | Prisma connects to SQLite | `npx prisma db execute` succeeds |
| A3 | Schema applies (SQLite provider) | `npx prisma migrate dev` succeeds |
| A4 | CRUD works (orders, positions, fills) | Write + read back each entity type |
| A5 | Transaction works | BEGIN → write → commit → SELECT confirms |
| A6 | Restart persistence works | Write → stop VUA → start VUA → SELECT confirms data |
| A7 | Concurrent access behavior understood | Document expected behavior (single-writer constraint) |
| A8 | Backup/restore verified | Backup → corrupt DB → restore → data matches |
| A9 | VUA restart does not lose persisted state | Full restart test with trading state |
| A10 | SQLite limitations documented | No production use on Profile A |

### Profile B (PostgreSQL Server) — Acceptance Gate

| # | Criterion | Validation Method |
|---|-----------|------------------|
| B1 | PostgreSQL 16 runtime available | `postgres --version` = 16.x |
| B2 | PostgreSQL starts (no systemd) | Manual `pg_ctl start` succeeds |
| B3 | Port 5432 reachable | `pg_isready -h localhost -p 5432` succeeds |
| B4 | Prisma connects | `npx prisma db execute` succeeds |
| B5 | Migration applies | `npx prisma migrate deploy` succeeds |
| B6 | Schema applies (11 entities) | `\dt` confirms all tables |
| B7 | Transaction works | BEGIN → write → commit → SELECT confirms |
| B8 | Concurrency validated | Multiple concurrent connections tested |
| B9 | Persistence survives restart | Write → `pg_ctl stop` → `pg_ctl start` → data present |
| B10 | Backup/restore verified | `pg_dump` → drop DB → restore → data matches |
| B11 | Reconciliation data survives restart | Write reconciliation_event → restart → SELECT confirms |

**Both gates must pass for their respective profiles. Profile A passing does not imply Profile B is validated, and vice versa.**

---

## STEP 14 — GAP ANALYSIS

### A. Existing ADR-002 Assumptions That Remain VALID

| Assumption | Status | Notes |
|-----------|--------|-------|
| Zero current persistence | ✓ VALID | No DB runtime exists |
| Source-of-truth model (exchange for fills/positions) | ✓ VALID | Applies to both profiles |
| ORDER → FILL (0..N) relationship | ✓ VALID | Works on both SQLite and PostgreSQL |
| Append-only event log design | ✓ VALID | Works on both |
| Idempotency requirements | ✓ VALID | Works on both |
| Failure/recovery scenarios | ✓ VALID | Profile-A-specific notes added |
| Schema (11 entities) | ✓ VALID | Both providers can represent all entities |
| PostgreSQL as production profile | ✓ VALID | Profile B unchanged |

### B. Existing ADR-002 Assumptions That Must CHANGE

| Assumption | Change | Reason |
|-----------|--------|--------|
| "PostgreSQL is the database" | Changed to "Two database profiles" | Environment limitation |
| "No SQLite" | Changed to "SQLite for Profile A" | Android/Termux cannot run PostgreSQL |
| "DATABASE_URL = postgresql://..." | Changed to conditional URL based on deployment profile | Must support both providers |
| "Prisma provider = postgresql" | Must support `sqlite` for Profile A | ORM must switch providers |
| "Migration = `prisma migrate deploy`" | Must support `prisma migrate dev` for Profile A | Different migration paths |
| Blockers section (no DB = architecture failure) | Reclassified as "deployment profile limitation" | Not an architecture failure |

### C. New SQLite Requirements

| Requirement | Detail | Priority |
|-------------|--------|----------|
| Prisma SQLite provider support | Schema must be provider-portable | P0 |
| SQLite runtime installation | `apt install sqlite3` or bundled | P0 |
| WAL mode configuration | `PRAGMA journal_mode=WAL` on startup | P0 |
| FK enforcement enablement | `PRAGMA foreign_keys=ON` on startup | P0 |
| Single-writer constraint awareness | No multi-process concurrent writes | P0 |
| File backup procedure | Documented + tested | P1 |
| Decimal precision acceptance | Document floating-point limitation for Profile A | P1 |
| Corruption recovery procedure | Document + test | P1 |

### D. PostgreSQL Requirements That Remain UNCHANGED

| Requirement | Status |
|-------------|--------|
| PostgreSQL 16 only | UNCHANGED |
| Docker Compose deployment for server | UNCHANGED |
| `pg_isready` health check | UNCHANGED |
| Connection pooling (Prisma Data Proxy or pgBouncer) | UNCHANGED |
| `prisma migrate deploy` for production | UNCHANGED |
| Full ACID guarantees | UNCHANGED |
| NUMERIC type for precise decimals | UNCHANGED |

### E. Cross-Document References That Must Be Updated

| Document | Update Required |
|----------|----------------|
| `22-architecture-decisions.md` | ADR-002 status → APPROVED (dual-profile); PostgreSQL = Profile B |
| `27-vua-master-project-map.md` | ADR-002 → APPROVED; P0-002 → dual-profile design approved; P0-002 environment blocker → reclassified as deployment profile limitation |
| `24-engineering-dependency-order.md` | ADR-002 → APPROVED; P0-002 continues as dual-profile |
| `25-master-work-breakdown.md` | TASK-P0-002 → dual-database profiles documented; SQLite added as new requirement |
| `34-p0-002-postgresql-implementation.md` | Status → APPROVED (design); BLOCKED-ENV status preserved for runtime |
| `35-p0-002-environment-blocker-checkpoint.md` | Add note: dual-profile architecture resolves environment limitation |
| `42-p0-002-pc-restoration-runbook.md` | PC path = Profile B (PostgreSQL); Android path = Profile A (SQLite) |
| `docs/audit/38-p0-003-execution-error-compatibility.md` | May need update if synthetic-fallback removal depends on DB profile |
| `docs/audit/39-p0-003-no-dummy-acceptance-contract.md` | No changes needed |
| `docs/audit/40-p0-003-no-dummy-fallback-implementation.md` | No changes needed |

### F. Implementation Work That Must Happen LATER

| Task | Priority | Blocking Dependencies |
|------|----------|----------------------|
| TASK-P0-002-A (SQLite Profile A runtime) | P0 | Environment restoration |
| TASK-P0-002-B (PostgreSQL Profile B runtime) | P0 | Docker-capable environment |
| TASK-P0-002-C (Prisma dual-provider schema validation) | P0 | Both profile runtimes |
| TASK-P0-002-D (Dual-profile migration tooling) | P0 | Both profile runtimes |
| TASK-P0-002-E (SQLite backup/recovery procedure) | P1 | Profile A runtime |
| TASK-P0-002-F (SQLite corruption detection) | P1 | Profile A runtime |

### G. Risks Introduced by Supporting Two Database Profiles

| Risk | Severity | Mitigation |
|------|----------|------------|
| Schema drift between profiles | HIGH | Single canonical schema; provider-specific migrations prohibited |
| Dual testing burden | MEDIUM | Automate both profile test suites |
| Developer confusion (which profile?) | MEDIUM | Clear deployment documentation per environment |
| SQLite used in production accidentally | HIGH | Production deployment documentation explicitly forbids Profile A |
| Decimal precision differences | MEDIUM | Application-layer Decimal.js; document limitation |
| Different concurrency behavior | MEDIUM | Single-process constraint for Profile A; documented |
| Backup procedure drift | LOW | Test both backup procedures; document separately |
| Performance difference masking bugs | LOW | Profile B performance is the reference; Profile A is dev-only |

### H. Risks That Are Explicitly NOT Solved by SQLite

| Risk | SQLite Does NOT Solve This |
|------|---------------------------|
| Production-grade ACID guarantees | ✗ — SQLite has limited isolation |
| Concurrent multi-writer workloads | ✗ — Single writer only |
| Distributed/multi-node deployment | ✗ — Single file on one device |
| Automated failover / high availability | ✗ — No HA for Profile A |
| Production-scale read throughput | ✗ — Not designed for server workloads |
| Cross-device data access | ✗ — File-based, device-local only |
| Streaming replication | ✗ — Not available in SQLite |
| Point-in-time recovery (automated) | △ — Manual only |
| Connection pooling | ✗ — Not applicable to single-file DB |

---

## STEP 15 — REVISED ADR STATUS

### ADR-002: Database Choice — APPROVED (DUAL-PROFILE)

**Decision:** Two-profile database architecture.

| Profile | Database | Provider | Environment | Status |
|---------|----------|----------|-------------|--------|
| **Profile A** | SQLite 3 | `prisma` with `sqlite` | Android / Termux / Ubuntu PRoot | APPROVED for local dev |
| **Profile B** | PostgreSQL 16 | `prisma` with `postgresql` | PC / Server / Production | APPROVED for production |

**ORM:** Prisma (provider-switching for schema compatibility)
**Prisma schema:** Canonical single schema, provider-switched at build time
**DATABASE_URL:** Determined by deployment profile
**Migration:** Shared migrations directory, provider-compatible SQL only

**Previous ADR-002 status:** SUPERSEDED by this revision.
**New ADR-002 status:** APPROVED — Dual-Profile Architecture.

---

## STEP 16 — REVISION APPROVAL

| Field | Value |
|-------|-------|
| ADR | ADR-002 |
| Revision | 2.0 |
| Date | 2026-09-01 |
| Status | APPROVED — Dual-Profile Architecture |
| Design Direction | APPROVED |
| Implementation | NOT YET STARTED |
| Role | Principal Engineer ONLY |
| Trader Brain | DISABLED |
| Live Trading | DISABLED |

**Implementation is authorized to proceed** for both profiles once environments are validated.
