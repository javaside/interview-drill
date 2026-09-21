import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import type { SqlRunner } from './adapters.js'

let cached: SqlRunner | undefined

/**
 * 生产 DB 客户端（node-postgres）。集成测试不走这里——它们用 pglite 的 drizzle 实例
 * 直接喂给 adapters/syncHandler（同为 SqlRunner 结构）。
 */
export function getDb(): SqlRunner {
  if (cached === undefined) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    cached = drizzle(pool) as unknown as SqlRunner
  }
  return cached
}
