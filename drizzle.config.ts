import { defineConfig } from 'drizzle-kit'
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  // migrate 用（generate 不需要）；从环境读，避免把连接串写死进 git
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://postgres:dev@localhost:5432/drill' },
})
