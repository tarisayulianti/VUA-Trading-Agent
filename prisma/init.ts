// P0-002 — Prisma Client Initialization (TypeScript Core)
// Source-of-truth: docs/audit/29-adr-002-database-review.md
// Architecture: TypeScript core, PostgreSQL persistence, Prisma ORM + Migrate
// Note: Reconciliation / Exchange integration NOT implemented (deferred to ADR-003 / P0-003).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export { prisma };
export default prisma;
