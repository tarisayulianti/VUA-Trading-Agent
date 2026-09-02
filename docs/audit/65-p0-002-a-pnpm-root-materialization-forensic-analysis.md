# P0-002-A — PNPM ROOT MATERIALIZATION FORENSIC INVESTIGATION

**Date:** 2026-09-02
**Environment:** Native Windows 10 x64, Node v22.23.2, pnpm 9.15.0
**Profile:** A — SQLite / development
**Task type:** Command-operator / read-only package-manager forensic
**Status:** FORENSIC COMPLETE / A2 NO-GO

---

## A. BASELINE

- Working tree: clean except untracked docs 61–64
- HEAD: `8d6043084f60efe21c7f3f983df4c8be1004ece0`
- origin/main: `8d6043084f60efe21c7f3f983df4c8be1004ece0`
- No tracked files modified
- package.json / pnpm-lock.yaml / prisma.config.ts: unchanged

---

## B. VIRTUAL-STORE STATE

Observed pnpm store layout:

- `node_modules/.pnpm/better-sqlite3@12.11.1/node_modules/better-sqlite3/` exists
- Contains package metadata, source, and native binary:
  `build/Release/better_sqlite3.node`
- Virtual-store symlink exists:
  `node_modules/.pnpm/node_modules/better-sqlite3` → store package
- Adapter store path contains symlink:
  `node_modules/.pnpm/@prisma+adapter-better-sqlite3@7.10.0/node_modules/better-sqlite3`
  → same store package

Conclusion:
The package is fully materialized in pnpm’s store, but that does **not**
guarantee root-level exposure.

---

## C. ADAPTER DEPENDENCY STRUCTURE

`node_modules/@prisma/adapter-better-sqlite3/package.json` declares:

- dependencies:
  - `better-sqlite3: ^12.6.0`
  - `@prisma/driver-adapter-utils: 7.10.0`

`pnpm-lock.yaml` resolves:

- `@prisma/adapter-better-sqlite3@7.10.0` → `better-sqlite3@12.11.1`

`pnpm why better-sqlite3` shows:

- `@prisma/adapter-better-sqlite3 7.10.0`
  - `better-sqlite3 12.11.1`
- `prisma 7.10.0` → peer `better-sqlite3 >=9.0.0`, optional=true
- `@prisma/client 7.10.0` → optional peer `prisma`

So the only **required** path is:
root → `@prisma/adapter-better-sqlite3` → `better-sqlite3`

---

## D. ROOT node_modules STRUCTURE

Observed root exposure:

- `node_modules/@prisma/adapter-better-sqlite3` → symlink into `.pnpm`
- `node_modules/@prisma/client` → symlink into `.pnpm`
- `node_modules/@prisma/client-runtime-utils` → symlink into `.pnpm`
- `node_modules/prisma` → symlink into `.pnpm`
- `node_modules/better-sqlite3` → **does not exist**

Critical gap:
`better-sqlite3` is **not hoisted or linked at the project root**, even though
its parent adapter is present.

---

## E. PNPM DEPENDENCY-TREE EVIDENCE

`pnpm list better-sqlite3 --depth 10`:

```
react-example@0.0.0 ...

devDependencies:
@prisma/adapter-better-sqlite3 7.10.0
└── better-sqlite3 12.11.1
@prisma/client 7.10.0
└─┬ prisma 7.10.0 peer
  └── better-sqlite3 12.11.1 peer
prisma 7.10.0
└── better-sqlite3 12.11.1 peer
```

`pnpm list --depth 0` shows:
`@prisma/adapter-better-sqlite3`, `@prisma/client`, `@prisma/client-runtime-utils`,
`prisma`, but **no root `better-sqlite3`**.

That confirms pnpm knows about `better-sqlite3`, but does not expose it at the
application root module-resolution boundary.

---

## F. PNPM CONFIGURATION EVIDENCE

Local config:

- `pnpm config get node-linker` → `undefined`
- `pnpm config get hoist` → `undefined`
- `pnpm config get shamefully-hoist` → `undefined`
- No `.npmrc`, `.pnpmrc`, `.pnpmfile.cjs`, `pnpm-workspace.yaml`
- Global config: only `global=true`, `registry`, `user-agent`

Interpretation:
Default pnpm 9.x virtual-store behavior applies.
No custom hoisting or linker override is configured.

---

## G. EXACT ROOT-CAUSE CLASSIFICATION

**Classification: pnpm 9.15.0 virtual-store root-materialization defect**

Evidence chain:

1. `better-sqlite3@12.11.1` is correctly resolved in `pnpm-lock.yaml`
2. The package is fully present in the pnpm store with native binary
3. The adapter package can internally link to it
4. `pnpm why` confirms the required dependency path exists
5. `pnpm list` confirms the package is not exposed at root depth 0
6. Node root resolution fails with `MODULE_NOT_FOUND`
7. No custom pnpm config explains the omission

This is not:

- a missing direct dependency requiring `package.json` change
- a lockfile corruption
- a Node/platform incompatibility
- a Prisma schema/config issue
- an application source issue

This is:

- pnpm’s virtual-store materialization/hoisting logic omitting a required
  transitive native dependency from root `node_modules` on this environment

---

## H. RESOLUTION OPTIONS

**Option 1: Explicit root materialization**
- Add `better-sqlite3@12.11.1` as a direct dependency
- Force pnpm to create `node_modules/better-sqlite3` at root
- Risk: changes manifest/authorized dependency graph

**Option 2: pnpm store repair / reinstall**
- Remove only the identified store entry and rerun install
- Risk: already attempted without success; may repeat silently

**Option 3: pnpm version/config change**
- Downgrade/upgrade pnpm or change `node-linker`/hoisting settings
- Risk: changes toolchain; broader than current authorization

**Option 4: Alternative adapter**
- Evaluate a SQLite adapter whose transitive dependencies pnpm exposes
- Risk: schema/migration/config changes likely

---

## I. RISK ASSESSMENT

| Option | Authorization scope | Reversibility | Risk level |
|---|---|---|---|
| 1 | High: manifest + lockfile | Medium | Medium |
| 2 | Medium: store mutation only | High | Low–Medium |
| 3 | High: toolchain change | Medium | High |
| 4 | High: architecture change | Low | High |

---

## J. AUTHORIZATION REQUIRED

Any repair path requires explicit authorization because:

- Option 1 modifies `package.json` and `pnpm-lock.yaml`
- Option 2 mutates the pnpm store
- Option 3 changes the package-manager behavior
- Option 4 changes the database adapter stack

Current validation-only scope does not authorize dependency mutation.

---

## K. A2 GO / NO-GO

**NO-GO**

Reason:
`better-sqlite3` is unresolved at the root module boundary despite valid store
materialization. This blocks Prisma SQLite runtime readiness.

---

## L. RECOMMENDED NEXT ACTION

Await authorization for **Option 1** only if minimal-change repair is desired:
add `better-sqlite3@12.11.1` as a direct dependency to force root
materialization without changing versions or adapter choice.

Do not proceed without explicit human authorization.

No commit. No push. No Prisma. No database.
