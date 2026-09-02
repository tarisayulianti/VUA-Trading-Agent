import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for server/db.ts');
}

const isSqlite = databaseUrl.startsWith('file:');

let prisma: PrismaClient;
if (isSqlite) {
  const adapter = new PrismaBetterSqlite3(
    new Database(databaseUrl.replace('file:', ''))
  );
  prisma = new PrismaClient({ adapter });
} else {
  prisma = new PrismaClient();
}

export { prisma as db };
