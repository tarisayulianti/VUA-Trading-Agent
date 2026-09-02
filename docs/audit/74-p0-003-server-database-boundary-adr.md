# P0-003 SERVER DATABASE BOUNDARY — ARCHITECTURE DECISION RECORD

**ADR ID:** ADR-P0-003-DB-BOUNDARY
**Topic:** Server-side database boundary for `system_events` logging from exchange services
**Date:** 2026-09-02
**Status:** DECIDED — READY FOR IMPLEMENTATION
**Depends on:** ADR-001 (APPROVED), ADR-002 (APPROVED), P0-002 (COMPLETE)
**Role:** Principal Engineer ONLY
**Trader Brain:** DISABLED
**Implementation:** NOT YET STARTED — design decision documented; implementation deferred to P0-003 Phase 3

---

## CONTEXT

P0-003 requires `system_events` data-quality logging from `server/services/binance.ts` and `server/services/bybit.ts`. The existing repository state shows:

- **No PrismaClient import or initialization exists in `server/`**
- **No database/service/ORM access pattern exists under `server/`**
- **`binance.ts` and `bybit.ts` have no established dependency-injection or service-layer path to database access**
- **`prisma/init.ts` exists but is NOT imported by any server code**
- **Profile A (`prisma-sqlite/`) and Profile B (`prisma/`) are isolated at the config/project-boundary level, not runtime-switched in server code**

The question: what is the canonical server-side database boundary for P0-003 Phase 3?

---

## OPTIONS EVALUATED

### Option A: Shared Prisma Singleton Imported by Services

**Description:** Create a new `server/db.ts` module that instantiates and exports a single `PrismaClient`. Exchange services import this singleton directly.

```typescript
// server/db.ts
import { PrismaClient } from '@prisma/client';
export const db = new PrismaClient({...});
```

```typescript
// server/services/binance.ts
import { db } from '../db';
// db.system_events.create(...)
```

**Pros:**
- Minimal code change
- Matches existing project singleton pattern (`binanceService`, `riskEngine`, `executionEngine`, etc.)
- No constructor changes to existing service classes
- Simple lifecycle: created at module load, reused for process lifetime
- Testable via module mocking

**Cons:**
- Couples exchange services to Prisma import path
- Profile selection happens at module load time, not runtime-switchable

### Option B: Prisma Instance Injected into Exchange Services

**Description:** Modify `BinanceService` and `BybitService` constructors to accept a `db` instance. Update all call sites and test harnesses.

```typescript
// server/services/binance.ts
export class BinanceService {
  constructor(private db: PrismaClient) {}
}
```

**Pros:**
- Explicit dependency injection
- Highly testable

**Cons:**
- Requires changing constructors of both exchange services
- Requires updating all instantiation sites (`new BinanceService()`, `new BybitService()`)
- Requires updating all imports in `api.ts` and any other consumer
- More invasive for P0-003's limited scope
- No existing DI framework in the project

### Option C: Repository/Database Service Abstraction

**Description:** Create a `server/services/database.ts` repository layer between exchange services and Prisma. Exchange services call repository methods, which internally use Prisma.

**Pros:**
- Cleanest separation of concerns
- Future-proof for schema changes

**Cons:**
- Over-engineering for current state: Prisma already provides a type-safe abstraction
- Adds another layer of indirection for a single `system_events` write path
- More files to maintain, review, and test
- No evidence in project docs that this level of abstraction is required

### Option D: Reuse `prisma/init.ts` Directly

**Description:** Import and reuse the existing `prisma/init.ts` singleton from server services.

**Pros:**
- Zero new files

**Cons:**
- `prisma/init.ts` uses default `@prisma/client` without adapter/profile selection
- Not designed for server-side use
- No clear Profile A/B selection mechanism from `server/`
- Would create hidden coupling between CLI scripts and server runtime
- **REJECTED:** insufficient isolation and unclear profile boundary

---

## DECISION

**CHOSEN OPTION: Option A — Shared Prisma Singleton (`server/db.ts`)**

**WHY:**
1. **Minimal invasiveness:** Only one new file; no changes to existing service constructors or call sites
2. **Project pattern alignment:** All other services (`riskEngine`, `executionEngine`, `memoryLedger`, `researchLab`) are module-level singletons. A `db` singleton fits this pattern exactly.
3. **Profile A/B isolation preserved:** Profile selection is determined by `DATABASE_URL` at startup, consistent with ADR-002's deployment-profile model. The application does NOT switch providers at runtime.
4. **Testability:** `server/db.ts` can be mocked in tests; no DI framework required.
5. **Future-proof:** When additional server-side DB access is needed (P0-004+), the same singleton is available.

**REJECTED OPTIONS AND REASONS:**
- **Option B (Injection):** Too invasive for P0-003. Would require changing constructors, call sites, and test harnesses across multiple files. The project has no DI framework, so injection provides no benefit over direct import.
- **Option C (Repository abstraction):** Over-engineering. Prisma already provides a type-safe repository pattern. Adding another abstraction layer for a single `system_events` write path violates YAGNI.
- **Option D (Reuse `prisma/init.ts`):** Insufficient isolation. That module is CLI-oriented and lacks clear server-side profile selection. Creating a dedicated `server/db.ts` establishes the correct boundary.

---

## SERVER DB BOUNDARY DESIGN

### Canonical Location

`server/db.ts` — the single source of truth for server-side Prisma client initialization.

### Profile A Boundary

- Config: `prisma-sqlite/prisma.config.ts`
- Adapter: `@prisma/adapter-better-sqlite3`
- Schema: `prisma-sqlite/schema-sqlite.prisma`
- Database: `prisma-sqlite/data/vua_p0_002_a.db`
- Selected when: `DATABASE_URL` matches SQLite pattern or Profile A environment is active
- Isolation: Separate project boundary; separate migrations; separate data directory

### Profile B Boundary

- Config: `prisma.config.postgres.ts`
- Provider: `postgresql`
- Schema: `prisma/schema.prisma`
- Database: PostgreSQL 16 (Docker/local)
- Selected when: `DATABASE_URL` matches PostgreSQL pattern or Profile B environment is active
- Isolation: Separate project boundary; separate migrations; separate data directory

### Profile Selection Mechanism

**Environment-based at startup, NOT runtime-switchable.**

```typescript
// server/db.ts
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';

const isSqlite = process.env.DATABASE_URL?.startsWith('file:') ?? false;

let prisma: PrismaClient;
if (isSqlite) {
  const adapter = new PrismaBetterSqlite3(new Database(process.env.DATABASE_URL!.replace('file:', '')));
  prisma = new PrismaClient({ adapter });
} else {
  prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
}

export { prisma as db };
```

**Rule:** Profile selection happens ONCE at server startup. The process does NOT switch between SQLite and PostgreSQL during its lifetime. This aligns with ADR-002's deployment-profile model.

---

## EXCHANGE SERVICE ACCESS

### Dependency Flow

```
Exchange Service (binance.ts / bybit.ts)
    ↓ import
server/db.ts (singleton PrismaClient)
    ↓ adapter/profile selection
Prisma + @prisma/adapter-better-sqlite3 OR native PostgreSQL
    ↓ query
system_events table
```

### Exchange Service Usage Pattern

```typescript
// server/services/binance.ts (conceptual — implementation detail)
import { db } from '../db';

catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  await db.system_events.create({
    data: {
      event_type: 'DATA_QUALITY_ERROR',
      severity: 'ERROR',
      source: 'binance',
      message: `getTicker failed for ${symbol}: ${message}`,
      metadata: { symbol, method: 'getTicker', error: message },
    },
  });
  throw new Error(`Binance getTicker failed for ${symbol}: ${message}`);
}
```

**Rule:** Exchange services import `db` from `server/db.ts` directly. They do NOT instantiate PrismaClient themselves. They do NOT know which profile is active. They do NOT handle connection lifecycle.

---

## CONNECTION LIFECYCLE

1. **Creation:** `server/db.ts` creates `PrismaClient` at module load time when first imported
2. **Reuse:** Single instance shared across all server modules via ES module singleton semantics
3. **Shutdown:** Server process exit disconnects naturally. No explicit `db.$disconnect()` required for current lifecycle.
4. **No connection pooling for Profile A:** SQLite uses single-process single-connection model. No pool needed.
5. **Profile B pooling:** Handled by Prisma's built-in PostgreSQL connection pooler. No external pooler required at this stage.

---

## TESTING STRATEGY

1. **Unit tests:** Mock `server/db.ts` using Jest/vi module mocking. Exchange services receive mock `db` with mocked `system_events.create`.
2. **Integration tests:** Use Profile A SQLite test database. Verify `system_events` records are created with correct `event_type`, `source`, and `message`.
3. **Profile isolation tests:** Verify that running with Profile A config writes to SQLite; running with Profile B config writes to PostgreSQL. No cross-profile contamination.
4. **No new table migrations:** `system_events` schema already exists in both Profile A and Profile B.

---

## SECURITY / ISOLATION RULES

1. **Profile A and Profile B are NEVER active in the same process.** The server process selects ONE profile at startup and uses it for its entire lifetime.
2. **No runtime profile switching.** If `DATABASE_URL` changes, a server restart is required.
3. **Exchange services cannot bypass the `db` boundary.** They must import from `server/db.ts`; they cannot instantiate their own PrismaClient.
4. **No cross-profile queries.** The `db` singleton is bound to one provider/adapter at creation time.
5. **`system_events` writes are append-only.** No update or delete operations on event records.

---

## MIGRATION IMPACT

- **No new migrations required.** `system_events` table already exists in both Profile A and Profile B schemas.
- **No schema changes.** P0-003 uses the existing `system_events` model with `event_type = 'DATA_QUALITY_ERROR'`.
- **Profile A migration history:** Untouched. `prisma-sqlite/migrations/` remains as-is.
- **Profile B migration history:** Untouched. `prisma/migrations/` remains as-is.

---

## P0-003 IMPACT

**This decision UNBLOCKS Phase 3.**

- Phase 1 (dead code removal): COMPLETE
- Phase 2 (USE_SYNTHETIC_DATA): COMPLETE
- Phase 3 (system_events logging): **UNBLOCKED** — canonical DB boundary established
- Phase 4 (/api/data-quality): Ready to proceed after Phase 3
- Phase 5 (frontend banner): Ready to proceed
- Phase 6 (.env.example): Ready to proceed

### Exact Next Implementation Step

Create `server/db.ts` with the shared Prisma singleton, selecting Profile A or Profile B based on `DATABASE_URL` at startup. Then add `system_events.create()` calls in the catch blocks of `binance.ts` and `bybit.ts`.

---

## FUTURE TRADER BRAIN IMPACT

- **Positive:** Trader Brain and other future services can use the same `server/db.ts` singleton for persistence.
- **No architectural conflict:** The singleton pattern is compatible with future multi-service expansion.
- **If Python worker is added later:** Per ADR-001, Python uses its own DB access path (`psycopg3` or SQLAlchemy core). The TypeScript `server/db.ts` boundary is for TypeScript services only. No coupling between runtimes.
- **If runtime profile switching becomes necessary in future:** Would require a wrapper factory around `server/db.ts`, but that is explicitly out of scope for P0-003 and contradicts ADR-002's deployment-profile model.

---

## DEPENDENCY FLOW (FORMAL)

```
Exchange Service (binance.ts / bybit.ts)
         │
         │ import { db } from '../db'
         ▼
Server DB Boundary (server/db.ts)
         │
         │ new PrismaClient({ adapter } | { datasourceUrl })
         ▼
Prisma Client (TypeScript runtime)
         │
         │ profile-selected adapter
         ▼
Profile A: @prisma/adapter-better-sqlite3 → better-sqlite3 → prisma-sqlite/data/vua_p0_002_a.db
Profile B: native PostgreSQL driver → PostgreSQL 16
         │
         │ Prisma query
         ▼
system_events table (append-only, event_type = 'DATA_QUALITY_ERROR')
```

---

## DECISION SUMMARY

| Field | Value |
|-------|-------|
| **Decision ID** | ADR-P0-003-DB-BOUNDARY |
| **Chosen option** | Option A: Shared Prisma singleton (`server/db.ts`) |
| **Rejected** | Option B (injection), Option C (repository), Option D (reuse prisma/init.ts) |
| **Server DB boundary** | `server/db.ts` — module-level singleton |
| **Profile A boundary** | `prisma-sqlite/` with `PrismaBetterSqlite3` adapter, selected by `DATABASE_URL=file:...` |
| **Profile B boundary** | `prisma/` with PostgreSQL provider, selected by `DATABASE_URL=postgresql://...` |
| **Exchange service access** | Direct import of `db` from `server/db.ts` |
| **Connection lifecycle** | Singleton at module load; single process lifetime; no runtime switching |
| **Testing strategy** | Mock `server/db.ts` for unit tests; Profile A SQLite for integration tests |
| **Security/isolation** | One profile per process; no cross-profile access; append-only events |
| **Migration impact** | None — `system_events` already exists in both profiles |
| **P0-003 impact** | Phase 3 UNBLOCKED |
| **Future Trader Brain impact** | Compatible; Python worker uses separate DB path per ADR-001 |

---

**DECISION STATUS: FINAL — IMPLEMENTATION AUTHORIZED FOR P0-003 PHASE 3**

**Files to be created/modified in Phase 3:**
- `server/db.ts` (new)
- `server/services/binance.ts` (add `db.system_events.create` in catch blocks)
- `server/services/bybit.ts` (add `db.system_events.create` in catch blocks)

**Files that must NOT be modified:**
- `prisma/init.ts`
- `prisma/schema.prisma`
- `prisma-sqlite/schema-sqlite.prisma`
- `prisma/migrations/`
- `prisma-sqlite/migrations/`
- Any frontend code
- Any other server service files
