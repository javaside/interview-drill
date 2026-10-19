import { sql } from 'drizzle-orm'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDb } from './helpers.js'
import type { TestDb } from './helpers.js'
import { runUpsert } from '../../src/server/content-upsert/run.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'

function runner(db: unknown): SqlRunner {
  return db as SqlRunner
}

test('试点块完整落库且可重复执行（幂等）', { timeout: 30_000 }, async () => {
  const t = await createTestDb()
  try {
    const db = runner(t.db)
    const r1 = await runUpsert(db)
    expect(r1.blocks).toBeGreaterThanOrEqual(1)
    expect(r1.cards).toBeGreaterThanOrEqual(5)
    const r2 = await runUpsert(db)
    expect(r2).toEqual(r1)
    const n = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from cards`)
    expect(n.rows[0]!.n).toBe(r1.cards)
  } finally {
    await t.pg.close()
  }
})

test('judgment 卡的 conclusion 字段落库', { timeout: 30_000 }, async () => {
  const t = await createTestDb()
  try {
    await runUpsert(runner(t.db))
    const rows = await t.db.execute<{ conclusion: string | null }>(
      sql`select conclusion from cards where card_type='judgment'`)
    expect(rows.rows.length).toBeGreaterThan(0)
    expect(rows.rows[0]!.conclusion).toMatch(/^(yes|no|depends)$/)
  } finally {
    await t.pg.close()
  }
})

test('源目录消失的卡被 tombstone 而非删除（§7 id 稳定性）', { timeout: 30_000 }, async () => {
  const t = await createTestDb()
  try {
    const db = runner(t.db)
    await runUpsert(db)
    // 手动插一张"已从源里消失"的卡（先补外键指向的块）
    await t.db.execute(sql`insert into blocks (id, name, category) values ('ghost-b','Ghost','ghost-cat')`)
    await t.db.execute(sql`
      insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
      values ('ghost','ghost-b','q','atomic','d','[]'::jsonb,'JDK 8+','mid')`)
    await runUpsert(db)
    const ghost = await t.db.execute<{ retired_at: string | null }>(
      sql`select retired_at from cards where id='ghost'`)
    expect(ghost.rows[0]!.retired_at).not.toBeNull()
    // 源里真实存在的卡不被 tombstone
    const live = await t.db.execute<{ n: number }>(
      sql`select count(*)::int as n from cards where retired_at is null`)
    expect(live.rows[0]!.n).toBeGreaterThanOrEqual(5)
  } finally {
    await t.pg.close()
  }
})

// ---- misconceptions（专属错误选项，spec §2.3）----

const MC_DIR_BLOCK = 'java/generics'
const MC_CARD_A = '01J8ZKQ7Y00000000000000MA'
const MC_CARD_B = '01J8ZKQ7Y00000000000000MB'

/** atomic 卡源：keyPoints 恒 1 条；mcs 为 null 时整个 misconceptions 字段不写（存量卡形态） */
function mcCardSrc(id: string, mcs: readonly string[] | null): string {
  const mcYaml = mcs === null ? '\n' : mcs.length > 0
    ? `\nmisconceptions:\n${mcs.map(m => `  - id: ${m}\n    text: 错误说法：${m}\n    why: 溯源：${m} 站不住`).join('\n')}\n`
    : '\nmisconceptions: []\n'
  return `---
id: ${id}
blockId: ${MC_DIR_BLOCK}
relatedBlocks: []
question: 泛型擦除后两个参数化类型的方法签名还不同吗？
cardType: atomic
appliesTo: JDK 8+
frequency: high
followUps: []
keyPoints:
  - id: kp-mc-1
    text: 泛型参数编译后被擦为上界，方法签名在字节码层面相同
    public: false
    verifiedAt: 2026-10-19
    excludeAsDistractorFor: []
    source:
      kind: source-code
      url: https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/List.java
      locator: List#of${mcYaml}---

泛型擦除是 JVM 的既成事实。`
}

/** misconceptions 全列快照（含 retired_at），行序确定 → 两次查询可直接 toEqual 比对逐字节等价 */
async function mcRows(t: TestDb) {
  const r = await t.db.execute<{ id: string; card_id: string; text: string; why: string; retired_at: string | null }>(
    sql`select id, card_id, text, why, retired_at from misconceptions order by card_id, id`)
  return r.rows
}

test('misconceptions：upsert 幂等、tombstone、retired 回写', { timeout: 30_000 }, async () => {
  const t = await createTestDb()
  // 临时 content 目录（对齐 demo-code.test.ts 的 mkdtemp 构造），不碰仓库 content/ 本体
  const dir = mkdtempSync(join(tmpdir(), 'mc-upsert-'))
  try {
    const db = runner(t.db)
    mkdirSync(join(dir, MC_DIR_BLOCK), { recursive: true })
    writeFileSync(join(dir, MC_DIR_BLOCK, 'block.yml'),
      'id: java/generics\nname: 泛型\ncategory: java\nstatus: wip\n')
    const writeA = (mcs: readonly string[]) =>
      writeFileSync(join(dir, MC_DIR_BLOCK, `${MC_CARD_A}.md`), mcCardSrc(MC_CARD_A, mcs))

    // 1) 首跑：卡带 3 条 mc → 库里 3 行 live，UpsertResult.misconceptions === 3
    writeA(['mc-1', 'mc-2', 'mc-3'])
    const r1 = await runUpsert(db, dir)
    expect(r1.misconceptions).toBe(3)
    const first = await mcRows(t)
    expect(first).toHaveLength(3)
    expect(first.every(r => r.retired_at === null && r.card_id === MC_CARD_A)).toBe(true)

    // 2) 重跑同目录 → 行数与内容逐字节等价（幂等，源确定 → 结果恒等）
    const r2 = await runUpsert(db, dir)
    expect(r2).toEqual(r1)
    expect(await mcRows(t)).toEqual(first)

    // 3) 删 1 条 mc 后重跑 → 该行 retired_at = current_date（tombstone，不物理删）
    writeA(['mc-1', 'mc-3'])
    await runUpsert(db, dir)
    const tombstoned = await mcRows(t)
    expect(tombstoned).toHaveLength(3)                    // 行还在，只是退役
    expect(tombstoned.find(r => r.id === 'mc-2')!.retired_at).not.toBeNull()
    expect(tombstoned.find(r => r.id === 'mc-1')!.retired_at).toBeNull()
    expect(tombstoned.find(r => r.id === 'mc-3')!.retired_at).toBeNull()

    // 4) 恢复该 mc 后重跑 → retired_at 回写 null（自动解除 tombstone，回到首跑快照）
    writeA(['mc-1', 'mc-2', 'mc-3'])
    await runUpsert(db, dir)
    expect(await mcRows(t)).toEqual(first)

    // 5) 卡不带 misconceptions 字段 → misconceptions 表不新增行（存量卡零迁移）
    writeFileSync(join(dir, MC_DIR_BLOCK, `${MC_CARD_B}.md`), mcCardSrc(MC_CARD_B, null))
    const r5 = await runUpsert(db, dir)
    expect(r5.cards).toBe(2)
    expect(r5.misconceptions).toBe(3)
    expect(await mcRows(t)).toEqual(first)                // B 卡 0 行，A 卡 3 行原样
  } finally {
    rmSync(dir, { recursive: true, force: true })
    await t.pg.close()
  }
})
