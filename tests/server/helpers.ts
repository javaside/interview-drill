import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 每个集成测试文件一个独立 pglite（真 PG 语义、进程内、无 Docker）。
 * 建表用 drizzle-kit 生成的 SQL（Task 2 产出），保证测试库结构与生产迁移同源。
 */
export async function createTestDb() {
  const pg = new PGlite()
  const db = drizzle(pg)
  const here = dirname(fileURLToPath(import.meta.url))
  const migrationsFolder = join(here, '..', '..', 'drizzle')
  if (await fs.stat(migrationsFolder).then(() => true).catch(() => false)) {
    await migrate(db, { migrationsFolder })
  }
  return { db, pg } as const   // 调用方 finally { await t.pg.close() }，不用 asyncDispose（ES2022 lib 无其类型）
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>   // db: pglite 驱动的 drizzle 实例（类型由推导自愈，不写死驱动类型名）
