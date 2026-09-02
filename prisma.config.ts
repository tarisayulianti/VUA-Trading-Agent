import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'schema-sqlite.prisma'),
  migrate: {
    async adapter() {
      const { PrismaBetterSQLite3 } = await import('@prisma/adapter-better-sqlite3')
      return new PrismaBetterSQLite3({
        url: process.env.DATABASE_URL ?? 'file:./data/vua_p0_002_a.db',
      })
    },
  },
})
