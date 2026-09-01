import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'schema-sqlite.prisma'),
  migrate: {
    async adapter() {
      const { PrismaSQLite } = await import('@prisma/adapter-sqlite')
      return new PrismaSQLite({
        url: process.env.DATABASE_URL ?? 'file:./data/vua_p0_002_a.db',
      })
    },
  },
})
