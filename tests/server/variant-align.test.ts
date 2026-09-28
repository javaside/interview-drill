import { sql } from 'drizzle-orm'
import { createTestDb, type TestDb } from './helpers.js'
import { reviewHandler } from '../../src/server/review.js'
import { requeueTodaysMissedCards, loadAllCards, loadSettings, entitlementOf } from '../../src/server/db/adapters.js'
import { practiceQueue, buildDistractorPools } from '../../src/server/queue.js'
import { payloadDepsOf } from '../../src/server/deps.js'
import type { DistractorPools } from '../../src/lib/options/types.js'
import type { SqlRunner } from '../../src/server/db/adapters.js'
import { localDateOf } from '../../src/server/time.js'
import { addDays } from '../../src/lib/scheduler/date.js'
import type { Submission } from '../../src/server/types.js'

const TZ = 'Asia/Shanghai'
let NOW = Date.UTC(2026, 8, 28, 3, 0)
const TODAY = localDateOf(NOW, TZ)

function runner(t: TestDb): SqlRunner {
  return t.db as unknown as SqlRunner
}

const kpSrc = JSON.stringify({ kind: 'official-doc', url: 'https://x', locator: 's' })
async function seed(): Promise<TestDb> {
  const t = await createTestDb()
  await t.db.execute(sql`insert into users (id, github_id) values ('u1', 'gh-u1')`)
  await t.db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', null, 45, ${TZ}, 'free', ${JSON.stringify(['b1'])}::jsonb)`)
  await t.db.execute(sql`insert into blocks (id, name, category) values ('b1', 'B1', 'cat-a')`)
  for (let n = 0; n < 2; n++) {
    const id = `c${n}`
    await t.db.execute(sql`
      insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
      values (${id}, 'b1', 'q', 'enumeration', 'd', '[]'::jsonb, 'JDK 8+', 'mid')`)
    for (let i = 0; i < 6; i++) {
      await t.db.execute(sql`
        insert into key_points (card_id, id, text, source, public, exclude_as_distractor_for)
        values (${id}, ${`${id}-k${i}`}, ${`${id}-pt-${i}`}, ${kpSrc}::jsonb, false, '[]'::jsonb)`)
    }
  }
  return t
}

/** 真实干扰池装配（同 deps.poolsOfFor 口径） */
async function realPools(t: TestDb): Promise<(cardId: string) => DistractorPools> {
  const row = await loadSettings(runner(t), 'u1')
  const ent = entitlementOf(row)
  const { cards, categories } = await loadAllCards(runner(t))
  const byId = new Map(cards.map(c => [c.cardId, c] as const))
  return (cardId: string): DistractorPools => {
    const card = byId.get(cardId)!
    return buildDistractorPools(card, cards, ent, categories)
  }
}

/** 客户端视角：从 payload 取第 index 张卡的展示变体 + 构造「全勾正确项」的提交 */
function clientSubmit(p: Awaited<ReturnType<typeof practiceQueue>>, index: number): Submission {
  const card = p.cards[index]!
  const variant = p.prepared[index]!.variants[0]!
  return {
    submissionId: `s-${Math.random().toString(36).slice(2)}`,
    cardId: card.cardId,
    reviewedAtMs: NOW,
    kind: 'selection',
    selected: [...variant.correctIndices],
  }
}

test('复现：同一天第二次刷同一张卡，反馈统计必须与展示变体一致（变体对齐契约）', async () => {
  const t = await seed()
  try {
    const pools = await realPools(t)
    // 第一次：练习页取队列 → 勾全部正确项 → 提交（应得满分）
    const p1 = await practiceQueue(payloadDepsOf(runner(t), 'u1', NOW), 'u1', 'b1')
    const sub1 = clientSubmit(p1, 0)
    const r1 = await reviewHandler(runner(t), 'u1', sub1, { serverNow: NOW, poolsOf: pools })
    expect(r1.score.num).toBe(r1.score.den)   // 全勾正确 → 满分
    expect(r1.feedback.wrongChecked).toBe(0)

    // 次日到期 → 再练错题拉回今天 → 重新取队列 → 第二次提交（仍按新展示变体全勾正确项）
    await t.db.execute(sql`
      update card_state set plan = ${JSON.stringify([addDays(TODAY, 1)])}::jsonb where card_id = ${sub1.cardId}`)
    await requeueTodaysMissedCards(runner(t), 'u1', TODAY)
    const p2 = await practiceQueue(payloadDepsOf(runner(t), 'u1', NOW), 'u1', 'b1')
    const idx = p2.cards.findIndex(c => c.cardId === sub1.cardId)
    const variant2 = p2.prepared[idx]!.variants[0]!
    const sub2: Submission = {
      submissionId: `s2-${Math.random().toString(36).slice(2)}`,
      cardId: sub1.cardId, reviewedAtMs: NOW + 1000, kind: 'selection',
      selected: [...variant2.correctIndices],
    }
    const r2 = await reviewHandler(runner(t), 'u1', sub2, { serverNow: NOW + 1000, poolsOf: pools })
    // 契约：客户端按展示变体全勾正确 → 服务端判分必须满分且零错勾
    expect(r2.feedback.wrongChecked).toBe(0)
    expect(r2.feedback.missed).toBe(0)
    expect(r2.score.num).toBe(r2.score.den)
  } finally {
    await t.pg.close()
  }
})
