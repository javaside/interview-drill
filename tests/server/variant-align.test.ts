import { sql } from 'drizzle-orm'
import { createTestDb, type TestDb } from './helpers.js'
import { reviewHandler } from '../../src/server/review.js'
import { variantAt } from '../../src/server/replay.js'
import {
  requeueTodaysMissedCards, loadAllCards, loadAllCardStates, loadSettings, entitlementOf,
} from '../../src/server/db/adapters.js'
import { practiceQueue, buildDistractorPools } from '../../src/server/queue.js'
import { payloadDepsOf } from '../../src/server/deps.js'
import type { DistractorPools } from '../../src/lib/options/types.js'
import type { PreparedVariant } from '../../src/lib/options/prepare.js'
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
  const ent = entitlementOf(row, Date.now())
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

// ---- 四象限：两分档 × 配/不配 mc，判分与展示同卷 ----

/** 取队列时的 reviewCount（非 0：idx 参与排列 seed，两口径必须同 idx 才逐字节一致） */
const QUAD_RC = 7

/**
 * 同块 b1 四张 enumeration 卡（各 3 条要点 → 干扰缺口 6）：
 *   qa = A) s=0 + mc×4   qb = B) s=0 + 无 mc
 *   qc = C) s=2/3 + mc×4 qd = D) s=2/3 + 无 mc
 * 配 mc 卡缺口 6 = 专属 4 + 池 2；无 mc 卡缺口全走同块池（其他三卡共 9 条，充足不降级）。
 */
async function seedQuadrants(): Promise<TestDb> {
  const t = await createTestDb()
  await t.db.execute(sql`insert into users (id, github_id) values ('u1', 'gh-u1')`)
  await t.db.execute(sql`
    insert into user_settings (user_id, ready_by_date, daily_capacity, timezone, plan, free_block_ids)
    values ('u1', null, 45, ${TZ}, 'free', ${JSON.stringify(['b1'])}::jsonb)`)
  await t.db.execute(sql`insert into blocks (id, name, category) values ('b1', 'B1', 'cat-a')`)
  const cases = [
    { id: 'qa', num: 0, den: 1, withMc: true },
    { id: 'qb', num: 0, den: 1, withMc: false },
    { id: 'qc', num: 2, den: 3, withMc: true },
    { id: 'qd', num: 2, den: 3, withMc: false },
  ] as const
  for (const c of cases) {
    await t.db.execute(sql`
      insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
      values (${c.id}, 'b1', ${`Q-${c.id}`}, 'enumeration', 'd', '[]'::jsonb, 'JDK 8+', 'mid')`)
    for (let i = 0; i < 3; i++) {
      await t.db.execute(sql`
        insert into key_points (card_id, id, text, source, public, exclude_as_distractor_for)
        values (${c.id}, ${`${c.id}-k${i}`}, ${`${c.id}-pt-${i}`}, ${kpSrc}::jsonb, false, '[]'::jsonb)`)
    }
    if (c.withMc) {
      for (let i = 0; i < 4; i++) {
        await t.db.execute(sql`
          insert into misconceptions (card_id, id, text, why)
          values (${c.id}, ${`${c.id}-m${i}`}, ${`错${c.id}-${i}`}, ${`因${c.id}-${i}`})`)
      }
    }
    await t.db.execute(sql`
      insert into card_state (user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count, algo_version)
      values ('u1', ${c.id}, 'learning', ${c.num}, ${c.den}, '[]'::jsonb, 0, ${QUAD_RC}, 'v1')`)
  }
  return t
}

test('serve == replay 四象限：两分档 × 配/不配 mc，变体逐字节一致', async () => {
  const t = await seedQuadrants()
  try {
    // 展示口径：practiceQueue 预生成的 variants[0]（取队列时的 s 与 reviewCount）
    const p = await practiceQueue(payloadDepsOf(runner(t), 'u1', NOW), 'u1', 'b1')
    // 判分口径：loadAllCards（内部走 loadCardSnapshots 投影）+ variantAt 重算
    const pools = await realPools(t)
    const { cards } = await loadAllCards(runner(t))
    const byId = new Map(cards.map(c => [c.cardId, c] as const))
    const stById = new Map((await loadAllCardStates(runner(t), 'u1', TODAY)).map(s => [s.cardId, s] as const))

    for (const cardId of ['qa', 'qb', 'qc', 'qd']) {
      const i = p.cards.findIndex(c => c.cardId === cardId)
      expect(i).toBeGreaterThanOrEqual(0)
      const served = p.prepared[i]!.variants[0]!
      const st = stById.get(cardId)!
      const replayed = variantAt(byId.get(cardId)!, pools(cardId), st.s, 'u1', st.reviewCount)
      // 判分与展示同卷（AGENTS.md 铁律）：逐字节一致——快照缺 mc 会让重算的池缺口
      // 不同、rng 序列不同、correctIndices 不同，判的就是另一份卷
      expect(JSON.stringify(served)).toBe(JSON.stringify(replayed))
      if (cardId === 'qa' || cardId === 'qc') {
        // 防「两侧同缺 mc」的空转一致：配 mc 的卡，两侧变体都必须真含全部 4 条专属项
        const want = new Set([0, 1, 2, 3].map(n => `${cardId}-m${n}`))
        expect(new Set(served.misconceptionIds)).toEqual(want)
        expect(new Set(replayed.misconceptionIds)).toEqual(want)
      }
    }

    // A/B 固定分支补充（Task 1 语义）：同 s 不同 idx 两次重算——集合相等（抽取 seed
    // 是恒定哨兵）、排列不同（排列 seed 随 idx 换）——熟练前反复摆同一组干扰项
    const setOf = (v: PreparedVariant) =>
      JSON.stringify([...v.distractorKeyPointIds, ...v.misconceptionIds].sort())
    for (const cardId of ['qa', 'qb']) {
      const card = byId.get(cardId)!
      const st = stById.get(cardId)!
      const v0 = variantAt(card, pools(cardId), st.s, 'u1', st.reviewCount)
      const v1 = variantAt(card, pools(cardId), st.s, 'u1', st.reviewCount + 1)
      expect(setOf(v0)).toBe(setOf(v1))
      expect(JSON.stringify(v0.optionTexts)).not.toBe(JSON.stringify(v1.optionTexts))
    }
  } finally {
    await t.pg.close()
  }
})

test('review_log.distractorIds 合并记录：mc id 与池要点 id 都在', async () => {
  const t = await seedQuadrants()
  try {
    const pools = await realPools(t)
    // qa：干扰 6 = 专属 4（qa-m*）+ 同块池 2（qb/qc/qd 的要点）
    const p = await practiceQueue(payloadDepsOf(runner(t), 'u1', NOW), 'u1', 'b1')
    const i = p.cards.findIndex(c => c.cardId === 'qa')
    const variant = p.prepared[i]!.variants[0]!
    await reviewHandler(runner(t), 'u1', {
      submissionId: 'mc-log-1', cardId: 'qa', reviewedAtMs: NOW, kind: 'selection',
      selected: [...variant.correctIndices],
    }, { serverNow: NOW, poolsOf: pools })

    const rows = await t.db.execute<{ distractor_ids: string[] }>(sql`
      select distractor_ids from review_log where card_id = 'qa'`)
    const ids = rows.rows[0]!.distractor_ids
    // 专属错误项 id（m*）全部在——合并前这里只有池要点 id，专属项查无此人
    for (let n = 0; n < 4; n++) expect(ids).toContain(`qa-m${n}`)
    // 池要点 id 也在：剩余 2 条全部来自 qb/qc/qd 的要点
    const poolIds = ids.filter(id => !id.startsWith('qa-m'))
    expect(poolIds).toHaveLength(2)
    for (const id of poolIds) expect(id).toMatch(/^(qb|qc|qd)-k\d$/)
    // 总数 = 干扰项 6（3 正确 + 6 干扰 = 选项 9）
    expect(ids).toHaveLength(6)
  } finally {
    await t.pg.close()
  }
})
