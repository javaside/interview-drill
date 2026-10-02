import { PGlite } from '@electric-sql/pglite'
import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 迁移回填的**数据级**回归（2026-10-02 上线风险最高的一步）。
 *
 * 为什么单独一个文件：`createTestDb` 一次性跑完所有迁移，无法观察「存量行的
 * plan='paid' 在 0005 之后变成什么」。这里的做法是**手工按序应用迁移**——
 * 先跑到 0004，播种一个付费用户，再单独跑 0005，断言 paid_until 被回填。
 *
 * 断言的意义：新代码只认 paid_until。若有人重跑 drizzle-kit generate 把手工
 * 追加的 UPDATE 覆盖掉，这条会红——否则故障要等到生产上有老用户掉权限才暴露。
 */

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle')

/** 按文件名升序返回迁移 SQL 文本（drizzle-kit 的编号即顺序） */
async function migrationSqlTexts(): Promise<Array<{ name: string; sql: string }>> {
  const files = (await fs.readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort()
  return Promise.all(files.map(async f => ({
    name: f,
    sql: await fs.readFile(join(MIGRATIONS_DIR, f), 'utf8'),
  })))
}

/** 逐条执行（`--> statement-breakpoint` 是 drizzle 的语句分隔标记） */
async function apply(pg: PGlite, sqlText: string): Promise<void> {
  for (const stmt of sqlText.split('--> statement-breakpoint')) {
    const t = stmt.trim()
    if (t !== '') await pg.exec(t)
  }
}

test('0005 把存量 plan=paid 的行回填成「执行时刻 + 30 天」', async () => {
  const pg = new PGlite()
  try {
    const migrations = await migrationSqlTexts()
    const target = migrations.findIndex(m => m.name.startsWith('0005'))
    expect(target).toBeGreaterThan(0)   // 找不到 0005 说明迁移被重命名/覆盖了

    // 1. 只跑到 0004——模拟迁移上线前的生产库
    for (const m of migrations.slice(0, target)) await apply(pg, m.sql)

    // 2. 播种：一个永久解锁的老用户 + 一个从未付费的用户
    await pg.exec(`insert into users (id, github_id) values ('legacy','gh-legacy'), ('newbie','gh-newbie')`)
    await pg.exec(`
      insert into user_settings (user_id, plan, free_block_ids)
      values ('legacy', 'paid', '["b1","b2","b3"]'::jsonb),
             ('newbie', 'free', '[]'::jsonb)`)

    // 3. 跑 0005
    await apply(pg, migrations[target]!.sql)

    // 4. 老用户被回填成约 30 天后到期（不 grandfather 是用户拍板：统一转 30 天）
    const legacy = await pg.query<{ paid_until: string | null }>(
      `select paid_until from user_settings where user_id = 'legacy'`)
    expect(legacy.rows[0]!.paid_until).not.toBeNull()
    const daysLeft = (new Date(legacy.rows[0]!.paid_until!).getTime() - Date.now()) / 86400_000
    expect(daysLeft).toBeGreaterThan(29.9)
    expect(daysLeft).toBeLessThan(30.1)

    // 5. 从未付费的用户不受影响（不会凭空得到通行证）
    const newbie = await pg.query<{ paid_until: string | null; grace_until: string | null }>(
      `select paid_until, grace_until from user_settings where user_id = 'newbie'`)
    expect(newbie.rows[0]!.paid_until).toBeNull()
    expect(newbie.rows[0]!.grace_until).toBeNull()

    // 6. 新列落位且默认空（老用户的宽限态未结算 → 未到期，不算异常）
    const g = await pg.query<{ grace_block_ids: string[] }>(
      `select grace_block_ids from user_settings where user_id = 'legacy'`)
    expect(g.rows[0]!.grace_block_ids).toEqual([])

    // 7. 老用户的勾选原样保留——由 loadSettings 的惰性结算在到期后收敛，
    //    迁移不越权动它（否则迁移当下就改变了老用户的排期范围）
    const sel = await pg.query<{ free_block_ids: string[] }>(
      `select free_block_ids from user_settings where user_id = 'legacy'`)
    expect(sel.rows[0]!.free_block_ids).toEqual(['b1', 'b2', 'b3'])
  } finally {
    await pg.close()
  }
})
