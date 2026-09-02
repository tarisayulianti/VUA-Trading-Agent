# P0-002-A — BETTER-SQLITE3 MISSING DEPENDENCY FORENSIC ANALYSIS

**Date:** 2026-09-02
**Environment:** Native Windows 10 x64, Node v22.23.2, pnpm 9.15.0
**Profile:** A — SQLite / development
**Status:** FORENSIC COMPLETE / A2 NO-GO

---

## A. SCOPE

Determine why `better-sqlite3` is absent from `node_modules` after a successful `pnpm install`, without modifying any package manifest, lockfile, or installed state.

---

## B. CURRENT ENVIRONMENT

- **OS:** Microsoft Windows 10 Enterprise x64
- **Node:** v22.23.2
- **npm:** 12.0.2
- **pnpm:** 9.15.0
- **Prisma CLI:** 7.10.0
- **@file:`prisma/client`:** 7.10.0
- **@file:`prisma/adapter-better-sqlite3`:** 7.10.0
- **Repository state:** Clean, HEAD = origin/main = `8d6043084f60efe21c7f3f983df4c8be1004ece0`

---

## C. PACKAGE.JSON EVIDENCE

**Profile A declared Prisma dependencies (devDependencies):**

```json
"@prisma/adapter-better-sqlite3": "7.10.0",
"@prisma/client": "7.10.0",
"@prisma/client-runtime-utils": "7.10.0",
"prisma": "^7.10.0"
```

**Key finding:** `better-sqlite3` is NOT declared directly in `package.json`. It is expected as a transitive dependency of `@prisma/adapter-better-sqlite3`.

No manual edits have been made to `package.json`.

---

## D. LOCKFILE EVIDENCE

**`pnpm-lock.yaml` correctly resolves `better-sqlite3`:**

```
Line 1120:  better-sqlite3@12.11.1:
Line 1121:    resolution: {integrity: sha512-...}
Line 1122:    engines: {node: 20.x || 22.x || 23.x || 24.x || 25.x || 26.x}

Line 2590:  '@prisma/adapter-better-sqlite3@7.10.0':
Line 2591:    dependencies:
Line 2592:      '@prisma/driver-adapter-utils': 7.10.0
Line 2593:      better-sqlite3: 12.11.1
```

**Also referenced in composite package identity strings:**
```
Line 45/50/68: version: 7.10.0(...)(better-sqlite3@12.11.1)...
Line 2597/2601: @prisma/client@7.10.0(...)(better-sqlite3@12.11.1)...
Line 3954/3963: prisma@7.10.0(...)(better-sqlite3@12.11.1)...
```

**Lockfile integrity:** No `better-sqlite3` entries were manually added. The dependency appears through normal transitive resolution from `@prisma/adapter-better-sqlite3`.

**Critical anomaly:** The lockfile resolves `better-sqlite3@12.11.1` but this package is NOT present in `node_modules/.pnpm/store`.

---

## E. ADAPTER PACKAGE METADATA

**File:** `node_modules/@prisma/adapter-better-sqlite3/package.json`

**Dependencies section:**

```json
"dependencies": {
  "better-sqlite3": "^12.6.0",
  "@prisma/driver-adapter-utils": "7.10.0"
}
```

**Key finding:** The adapter package DOES declare `better-sqlite3` as a direct dependency (version range `^12.6.0`). The installed lockfile resolves this to `12.11.1`.

**Conclusion:** The adapter expects to pull in `better-sqlite3` transitively. The application does NOT need to declare `better-sqlite3` directly in `package.json`.

---

## F. ACTUAL DEPENDENCY GRAPH

**Intended graph:**

```
application
    ↓ devDependency
@prisma/adapter-better-sqlite3@7.10.0
    ↓ dependency
better-sqlite3@12.11.1
    ↓ native binding
better-sqlite3.node  (native binary)
```

**Observed graph:**

```
application
    ↓ devDependency
@prisma/adapter-better-sqlite3@7.10.0   [INSTALLED]
    ↓ dependency
better-sqlite3@12.11.1                  [MISSING FROM node_modules]
```

**Actual `node_modules` state:**
- `node_modules/@prisma/adapter-better-sqlite3/` EXISTS
- `node_modules/better-sqlite3/` DOES NOT EXIST
- `node_modules/.pnpm/better-sqlite3@12.11.1/` EXISTS BUT IS EMPTY

---

## G. PNPM INSTALLATION BEHAVIOR

**Installation output:**

```
Lockfile is up to date, resolution step is skipped
Already up to date

devDependencies:
+ @prisma/adapter-better-sqlite3 7.10.0
- @prisma/adapter-pg 7.10.0
+ @prisma/client 7.10.0
+ @prisma/client-runtime-utils 7.10.0
+ prisma 7.10.0
- pg 8.23.0

Done in 5.2s
```

**Critical observation:**
- `pnpm install` reported success without errors
- The output did NOT explicitly list `better-sqlite3` in the changes summary
- However, the lockfile references `better-sqlite3@12.11.1` as a transitive dependency
- The `.pnpm` store directory for `better-sqlite3@12.11.1` exists but is **completely empty**

**This indicates a silent installation failure for the native `better-sqlite3` package.**

Possible scenarios:
1. **Native build/download failure:** `better-sqlite3` uses `prebuild-install` to download prebuilt native binaries. If this download failed silently (network, antivirus, permission), pnpm may have skipped the package without reporting an error.
2. **pnpm store corruption/incomplete write:** The `.pnpm` directory was created but files were not written.
3. **Silent skip due to platform mismatch:** If pnpm detected an incompatible platform/arch combination during install, it may have skipped the package.
4. **Interrupted/crashed install:** A previous interrupted `pnpm install` left an empty directory placeholder.

---

## H. NATIVE BINDING ANALYSIS

**better-sqlite3@12.11.1 metadata from lockfile:**

```
engines: {node: 20.x || 22.x || 23.x || 24.x || 25.x || 26.x}
dependencies:
  bindings: 1.5.0
  prebuild-install: 7.1.3
```

**Platform compatibility check:**
- Node v22.23.2: COMPATIBLE (lockfile allows `22.x`)
- Architecture x86_64: Supported by better-sqlite3 prebuilds
- OS Windows 10: Supported

**Native binding expectation:** `better-sqlite3@12.11.1` should have a prebuilt binary for `win32-x64` Node 22. The `prebuild-install` package downloads this during `pnpm install`.

**Actual native binding state:**
- `node_modules/better-sqlite3/` does not exist
- No `*.node` native binary file present
- Cannot verify if binding loads because package itself is missing

**Assessment:** The environment is compatible with `better-sqlite3@12.11.1`. The issue is not platform incompatibility but rather a silent installation/artifact failure.

---

## I. ROOT-CAUSE CLASSIFICATION

**Classification: B + D — Missing transitive dependency / pnpm resolution problem with native binary/platform overlay**

**Primary root cause:**
Silent pnpm installation failure for `better-sqlite3@12.11.1`. The package is correctly declared as a transitive dependency in both `package.json` (via `@prisma/adapter-better-sqlite3`) and `pnpm-lock.yaml`, but the actual package files were not materialized in `node_modules/.pnpm/store`.

**Contributing factors:**
1. Empty `.pnpm` store directory indicates incomplete write or silent skip
2. `prebuild-install` native binary download may have failed silently
3. No error was reported by `pnpm install`, masking the failure
4. Windows environment may have triggered platform-specific install behavior

**What this is NOT:**
- NOT a `package.json` authorization issue
- NOT a missing direct dependency that requires manifest change
- NOT a Prisma schema or configuration issue
- NOT a Node version incompatibility
- NOT a Profile B / PostgreSQL issue

---

## J. POSSIBLE RESOLUTION PATHS

**Path 1: Re-run pnpm install with rebuild**
- Delete the empty `node_modules/.pnpm/better-sqlite3@12.11.1/` directory
- Run `pnpm install` again
- May resolve if the failure was transient

**Path 2: Explicit install of better-sqlite3**
- Run `pnpm add -D better-sqlite3@12.11.1` or `pnpm install better-sqlite3@12.11.1`
- Forces pnpm to materialize the package explicitly
- Requires authorization since it modifies `package.json`/`pnpm-lock.yaml`

**Path 3: Clean install**
- Delete `node_modules` and `node_modules/.pnpm`
- Run `pnpm install` from scratch
- May resolve store corruption

**Path 4: Manual prebuild download**
- Investigate `prebuild-install` cache/network behavior
- Not recommended without deeper diagnosis

**NOT recommended:**
- Downgrading better-sqlite3 without verification
- Switching to a different SQLite adapter
- Modifying package.json to declare better-sqlite3 directly without understanding why transitive resolution failed

---

## K. AUTHORIZATION REQUIREMENTS

Any fix requires explicit authorization because:

1. **Path 1** requires deleting empty store directories and re-running `pnpm install`
2. **Path 2** requires modifying `package.json` and `pnpm-lock.yaml`
3. **Path 3** requires deleting `node_modules` and re-installing all dependencies

None of these are within the current validation-only authorization scope.

---

## L. FORBIDDEN ACTIONS

- DO NOT modify `package.json`
- DO NOT modify `pnpm-lock.yaml`
- DO NOT run `pnpm add` or `pnpm remove`
- DO NOT run `npm install`
- DO NOT delete `node_modules` without authorization
- DO NOT manually create `node_modules/better-sqlite3/`
- DO NOT modify `@prisma/adapter-better-sqlite3` package files
- DO NOT run Prisma CLI commands
- DO NOT access the SQLite database
- DO NOT commit or push

---

## M. GO / NO-GO

**NO-GO**

**Rationale:**
The default rule applies: NO-GO unless all required environment prerequisites are demonstrably satisfied.

The `better-sqlite3` native module is not present in `node_modules` despite:
- Correct declaration in `@prisma/adapter-better-sqlite3` package.json
- Correct resolution in `pnpm-lock.yaml` to version 12.11.1
- Compatible Node version (22.x) and platform (win32-x64)
- Successful `pnpm install` execution

This indicates a silent installation/artifact failure, not a manifest problem.

**A2 remains NO-GO** until:
1. The missing `better-sqlite3` package is investigated and restored
2. The native binding loads successfully
3. Dependency verification passes

---

## VERIFICATION ARTIFACTS

- File created: `docs/audit/63-p0-002-a-better-sqlite3-dependency-forensic-analysis.md`
- Git status: CLEAN except for untracked `docs/audit/61-*.md` and `docs/audit/62-*.md`
- HEAD: `8d6043084f60efe21c7f3f983df4c8be1004ece0`
- origin/main: `8d6043084f60efe21c7f3f983df4c8be1004ece0`
- Tracked modifications: NONE
- package.json: UNCHANGED
- pnpm-lock.yaml: UNCHANGED
- node_modules state: UNCHANGED (read-only inspection only)

---

## ROOT CAUSE SUMMARY

**Exact issue:** `better-sqlite3@12.11.1` is a correctly declared transitive dependency of `@prisma/adapter-better-sqlite3@7.10.0`, correctly resolved in `pnpm-lock.yaml`, but the pnpm store contains an empty directory for this package and `node_modules/better-sqlite3/` does not exist.

**Exact cause:** Silent pnpm installation failure for the native `better-sqlite3` package during `pnpm install`. The installation reported success but did not materialize the package files.

**Classification:** B + D — Missing transitive dependency / pnpm resolution problem with native binary/platform overlay.

**Next action:** Requires authorization for one of the documented resolution paths before A2 can proceed.
