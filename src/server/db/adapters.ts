import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { ulid } from 'ulid'
import { rat } from '../../lib/scheduler/types.js'
import type { CardState, Rational } from '../../lib/scheduler/types.js'
import { diffDays } from '../../lib/scheduler/date.js'
import type { LocalDate } from '../../lib/scheduler/date.js'
import { makeFreeEntitlement, makePaidEntitlement } from '../../lib/entitlement/entitlement.js'
import type { Entitlement } from '../../lib/entitlement/entitlement.js'
import { ALGO_VERSION } from '../version.js'
import type { CardSnapshot, Settings } from '../types.js'
import type { ReplaySnapshot, ReplayLogRow } from '../replay.js'

/**
 * 双驱动结构类型：pglite / node-postgres 的 drizzle 实例都满足（都有 execute + transaction）。
 * adapters 只写查询，不绑定具体驱动类型名（计划「文件结构」：SQL 只出现在 db/）。
 */
export interface SqlRunner {
  execute<T = Record<string, unknown>>(query: unknown): Promise<{ rows: T[] }>
  transaction<T>(fn: (tx: SqlRunner) => Promise<T>): Promise<T>
}

/** 把字符串数组展开成 `(v1, v2, ...)` 的绑定参数列表——drizzle 的 sql 模板不会自动展开数组 */
function inList(values: string[]): SQL {
  return sql`(${sql.join(values.map(v => sql`${v}`), sql`, `)})`
}

export type UserSettingsRow = Settings & { timezone: string; plan: 'free' | 'paid'; freeBlockIds: string[] }

/** user_settings → 内存设置（readyByDate 可空 = 维持模式） */
export async function loadSettings(db: SqlRunner, userId: string): Promise<UserSettingsRow> {
  const r = await db.execute<{
    ready_by_date: string | null; daily_capacity: number; timezone: string
    plan: string; free_block_ids: string[]
  }>(sql`
    select ready_by_date, daily_capacity, timezone, plan, free_block_ids
    from user_settings where user_id = ${userId}`)
  const row = r.rows[0]
  if (row === undefined) throw new Error(`用户设置缺失：${userId}`)
  return {
    readyByDate: row.ready_by_date,
    dailyCapacity: row.daily_capacity,
    timezone: row.timezone,
    plan: row.plan === 'paid' ? 'paid' : 'free',
    freeBlockIds: row.free_block_ids ?? [],
  }
}

/** UserSettingsRow → Entitlement（付费恒空 freeBlockIds） */
export function entitlementOf(row: UserSettingsRow): Entitlement {
  return row.plan === 'paid' ? makePaidEntitlement() : makeFreeEntitlement(row.freeBlockIds)
}

/** cards + key_points → CardSnapshot（判分/装配所需的最小投影） */
export async function loadCardSnapshots(db: SqlRunner, cardIds: string[]): Promise<Map<string, CardSnapshot>> {
  const out = new Map<string, CardSnapshot>()
  if (cardIds.length === 0) return out
  const cards = await db.execute<{
    id: string; block_id: string; card_type: string; frequency: string; conclusion: string | null
  }>(sql`
    select id, block_id, card_type, frequency, conclusion
    from cards where id in ${inList(cardIds)}`)
  const kps = await db.execute<{
    card_id: string; id: string; text: string; public: boolean
    exclude_as_distractor_for: string[]; retired_at: string | null; order: number | null
  }>(sql`
    select card_id, id, text, public, exclude_as_distractor_for, retired_at, "order"
    from key_points where card_id in ${inList(cardIds)}`)
  const kpByCard = new Map<string, CardSnapshot['keyPoints']>()
  for (const k of kps.rows) {
    const arr = kpByCard.get(k.card_id) ?? []
    arr.push({
      id: k.id, text: k.text, public: k.public,
      excludeAsDistractorFor: k.exclude_as_distractor_for ?? [],
      ...(k.retired_at ? { retiredAt: k.retired_at } : {}),
      ...(k.order !== null ? { order: k.order } : {}),
    })
    kpByCard.set(k.card_id, arr)
  }
  for (const c of cards.rows) {
    out.set(c.id, {
      cardId: c.id,
      blockId: c.block_id,
      cardType: c.card_type as CardSnapshot['cardType'],
      frequency: c.frequency as CardSnapshot['frequency'],
      keyPoints: kpByCard.get(c.id) ?? [],
      ...(c.conclusion ? { conclusion: c.conclusion as CardSnapshot['conclusion'] } : {}),
    })
  }
  return out
}

/** card_state → 偏移域（plan 绝对日期经 diffDays 转相对 today） */
export async function loadCardStates(
  db: SqlRunner, userId: string, cardIds: string[], today: LocalDate,
): Promise<Map<string, CardState>> {
  const out = new Map<string, CardState>()
  if (cardIds.length === 0) return out
  const r = await db.execute<{
    card_id: string; phase: string; s_num: number; s_den: number
    plan: string[]; phase_index: number; review_count: number
  }>(sql`
    select card_id, phase, s_num, s_den, plan, phase_index, review_count
    from card_state where user_id = ${userId} and card_id in ${inList(cardIds)}`)
  for (const row of r.rows) {
    out.set(row.card_id, {
      cardId: row.card_id,
      phase: row.phase as CardState['phase'],
      s: rat(row.s_num, row.s_den),
      plan: (row.plan ?? []).map(d => diffDays(d, today)),
      phaseIndex: row.phase_index,
      reviewCount: row.review_count,
    })
  }
  return out
}

/**
 * 每卡最近 n 次得分（新→旧），供 weightedS。
 * review_log 只存 correctChecked/wrongChecked/keyPointsTotal，按 scoreSelection 口径
 * 重建 rat(max(0, 对−错), 总)——对 selection/atomic 精确，对 judgment 结论错(=0)亦精确；
 * judgment 结论对时忽略了 0.5 基分（已知有损，schema 未存原始分，见计划复现边界注）。
 */
export async function recentScoresOf(
  db: SqlRunner, userId: string, cardIds: string[], n: number,
): Promise<Map<string, Rational[]>> {
  const out = new Map<string, Rational[]>()
  if (cardIds.length === 0) return out
  const r = await db.execute<{
    card_id: string; correct_checked: number; wrong_checked: number; key_points_total: number
  }>(sql`
    select card_id, correct_checked, wrong_checked, key_points_total
    from review_log
    where user_id = ${userId} and card_id in ${inList(cardIds)}
    order by reviewed_at desc`)
  for (const row of r.rows) {
    const arr = out.get(row.card_id) ?? []
    if (arr.length >= n) continue
    arr.push(rat(Math.max(0, row.correct_checked - row.wrong_checked), Math.max(1, row.key_points_total)))
    out.set(row.card_id, arr)
  }
  return out
}

/** 已落库的 submissionId（幂等去重的 DB 侧来源） */
export async function knownSubmissionIds(db: SqlRunner, submissionIds: string[]): Promise<Set<string>> {
  if (submissionIds.length === 0) return new Set()
  const r = await db.execute<{ submission_id: string }>(sql`
    select submission_id from review_log where submission_id in ${inList(submissionIds)}`)
  return new Set(r.rows.map(x => x.submission_id))
}

/**
 * 组装回放快照（一次装齐纯核 applySubmissions 所需的全部只读数据）。
 */
export async function loadReplaySnapshot(
  db: SqlRunner, userId: string, subs: { cardId: string; submissionId: string }[], today: LocalDate,
): Promise<ReplaySnapshot> {
  const cardIds = [...new Set(subs.map(s => s.cardId))]
  const submissionIds = subs.map(s => s.submissionId)
  const [cards, states, recents, known] = await Promise.all([
    loadCardSnapshots(db, cardIds),
    loadCardStates(db, userId, cardIds, today),
    recentScoresOf(db, userId, cardIds, 2),
    knownSubmissionIds(db, submissionIds),
  ])
  return { cards, states, recents, knownSubmissionIds: known }
}

/**
 * 落库事务：逐行 INSERT review_log ON CONFLICT DO NOTHING（幂等键 = submissionId），
 * 并对涉及卡 UPSERT card_state（plan 已由调用方转绝对日期）。append-only（§8.1）。
 */
export async function syncTransaction(
  db: SqlRunner,
  userId: string,
  logRows: ReplayLogRow[],
  newStates: Array<{ cardId: string; state: CardState; planDates: LocalDate[] }>,
  settingsAtReview: { readyByDate: LocalDate | null; dailyCapacity: number },
): Promise<void> {
  await db.transaction(async tx => {
    for (const row of logRows) {
      await tx.execute(sql`
        insert into review_log (
          id, submission_id, user_id, card_id, reviewed_at, local_date,
          correct_checked, wrong_checked, key_points_total,
          ready_by_date_at_review, daily_capacity_at_review,
          distractor_ids, clock_clamped, algo_version)
        values (
          ${ulid()}, ${row.submissionId}, ${userId}, ${row.cardId},
          ${new Date(row.reviewedAtMs).toISOString()}, ${row.localDate},
          ${row.correctChecked}, ${row.wrongChecked}, ${row.keyPointsTotal},
          ${settingsAtReview.readyByDate}, ${settingsAtReview.dailyCapacity},
          ${JSON.stringify(row.distractorIds)}, ${row.clockClamped}, ${ALGO_VERSION})
        on conflict (submission_id) do nothing`)
    }
    for (const { cardId, state, planDates } of newStates) {
      await tx.execute(sql`
        insert into card_state (
          user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count, algo_version, updated_at)
        values (
          ${userId}, ${cardId}, ${state.phase}, ${state.s.num}, ${state.s.den},
          ${JSON.stringify(planDates)}, ${state.phaseIndex}, ${state.reviewCount}, ${ALGO_VERSION}, now())
        on conflict (user_id, card_id) do update set
          phase = excluded.phase, s_num = excluded.s_num, s_den = excluded.s_den,
          plan = excluded.plan, phase_index = excluded.phase_index,
          review_count = excluded.review_count, algo_version = excluded.algo_version, updated_at = now()`)
    }
  })
}

/**
 * 全库卡快照 + blockId→category 映射（唯一池装配需要全库视图；未退役卡才进队列）。
 * 干扰项池要能看到未解锁块的 public 语料，故装配用全库卡，entitlement 过滤在装配内。
 */
export async function loadAllCards(
  db: SqlRunner,
): Promise<{ cards: CardSnapshot[]; categories: Map<string, string> }> {
  const cardRows = await db.execute<{ id: string }>(sql`
    select id from cards where retired_at is null`)
  const ids = cardRows.rows.map(r => r.id)
  const snapMap = await loadCardSnapshots(db, ids)
  const blockRows = await db.execute<{ id: string; category: string }>(sql`
    select id, category from blocks`)
  const categories = new Map(blockRows.rows.map(b => [b.id, b.category] as const))
  // 按 cardId 稳定排序，装配与队列的输入顺序确定（schedule 内部会再排，这里只求可复现）
  const cards = [...snapMap.values()].sort((a, b) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0))
  return { cards, categories }
}

/** 某用户全部卡状态 → 偏移域（plan 绝对日期经 diffDays 转相对 today） */
export async function loadAllCardStates(
  db: SqlRunner, userId: string, today: LocalDate,
): Promise<CardState[]> {
  const r = await db.execute<{
    card_id: string; phase: string; s_num: number; s_den: number
    plan: string[]; phase_index: number; review_count: number
  }>(sql`
    select card_id, phase, s_num, s_den, plan, phase_index, review_count
    from card_state where user_id = ${userId}`)
  return r.rows.map(row => ({
    cardId: row.card_id,
    phase: row.phase as CardState['phase'],
    s: rat(row.s_num, row.s_den),
    plan: (row.plan ?? []).map(d => diffDays(d, today)),
    phaseIndex: row.phase_index,
    reviewCount: row.review_count,
  }))
}

/**
 * 新计划落盘（绝对日期 + planGeneratedAt + algoVersion）。plan[] 唯一写者之一。
 * 新卡首次得计划 → phase 'new'→'learning'（plan-once：下次不再当 fresh 重算，I4）；
 * 已在学/维持的卡 phase 原样保留。
 */
export async function persistPlans(
  db: SqlRunner, userId: string, plans: Array<{ cardId: string; plan: LocalDate[] }>,
): Promise<void> {
  if (plans.length === 0) return
  await db.transaction(async tx => {
    for (const { cardId, plan } of plans) {
      await tx.execute(sql`
        insert into card_state (
          user_id, card_id, phase, plan, phase_index, review_count,
          plan_generated_at, algo_version, updated_at)
        values (
          ${userId}, ${cardId}, 'learning', ${JSON.stringify(plan)}::jsonb, 0, 0,
          now(), ${ALGO_VERSION}, now())
        on conflict (user_id, card_id) do update set
          plan = excluded.plan,
          plan_generated_at = now(),
          phase = case when card_state.phase = 'new' then 'learning' else card_state.phase end,
          algo_version = excluded.algo_version,
          updated_at = now()`)
    }
  })
}

/**
 * 当天首次取队列写定 queueSize（§6 分母），之后不动（ON CONFLICT DO NOTHING）。
 * 返回当天生效的 queueSize（首写值——刷卡后再取队列分母不变）。
 */
export async function ensureDailySession(
  db: SqlRunner, userId: string, today: LocalDate, queueSize: number,
): Promise<number> {
  await db.execute(sql`
    insert into daily_session (user_id, local_date, queue_size)
    values (${userId}, ${today}, ${queueSize})
    on conflict (user_id, local_date) do nothing`)
  const r = await db.execute<{ queue_size: number }>(sql`
    select queue_size from daily_session where user_id = ${userId} and local_date = ${today}`)
  return r.rows[0]?.queue_size ?? queueSize
}

/** 今日进度分子（§6）：当天已刷的不同卡数 */
export async function countTodayDone(
  db: SqlRunner, userId: string, today: LocalDate,
): Promise<number> {
  const r = await db.execute<{ n: number }>(sql`
    select count(distinct card_id)::int as n from review_log
    where user_id = ${userId} and local_date = ${today}`)
  return r.rows[0]?.n ?? 0
}

/** 设置变更（§5.5 条件 2/3）：只更新传入字段，其余不动 */
export async function updateUserSettings(
  db: SqlRunner, userId: string,
  next: { readyByDate?: LocalDate | null; dailyCapacity?: number },
): Promise<void> {
  const sets: SQL[] = []
  if ('readyByDate' in next) sets.push(sql`ready_by_date = ${next.readyByDate ?? null}`)
  if (next.dailyCapacity !== undefined) sets.push(sql`daily_capacity = ${next.dailyCapacity}`)
  if (sets.length === 0) return
  sets.push(sql`updated_at = now()`)
  await db.execute(sql`
    update user_settings set ${sql.join(sets, sql`, `)} where user_id = ${userId}`)
}

/** 更新免费块集（§5.5 条件 4） */
export async function updateFreeBlockIds(
  db: SqlRunner, userId: string, blockIds: readonly string[],
): Promise<void> {
  await db.execute(sql`
    update user_settings set free_block_ids = ${JSON.stringify([...blockIds])}::jsonb, updated_at = now()
    where user_id = ${userId}`)
}

/**
 * 清空活跃卡（非 paused/done）的计划（§5.5 条件 2/3 的重排前置）：
 * plan 置空、plan_generated_at 归零，phase 保留——随后 buildDailyPayload 视其为
 * fresh 重新生成。返回被清空的卡数（= 待重排数）。
 */
export async function clearActivePlans(db: SqlRunner, userId: string): Promise<number> {
  const r = await db.execute<{ card_id: string }>(sql`
    update card_state set plan = '[]'::jsonb, plan_generated_at = null, updated_at = now()
    where user_id = ${userId} and phase not in ('paused', 'done')
      and jsonb_array_length(plan) > 0
    returning card_id`)
  return r.rows.length
}

/**
 * 暂停指定块的活跃卡（§5.5 减块）：phase→'paused'，**plan 原样保留**（复购即恢复）。
 * 返回被暂停的卡数。
 */
export async function pauseCardsInBlocks(
  db: SqlRunner, userId: string, blockIds: readonly string[],
): Promise<number> {
  if (blockIds.length === 0) return 0
  const r = await db.execute<{ card_id: string }>(sql`
    update card_state set phase = 'paused', updated_at = now()
    where user_id = ${userId} and phase not in ('paused', 'done')
      and card_id in (select id from cards where block_id in ${inList([...blockIds])})
    returning card_id`)
  return r.rows.length
}

/**
 * 恢复指定块的暂停卡（§5.5 加回）：paused→ 有计划则 'learning'、否则 'new'，
 * plan 不动（保留 → plan-once 不重排，往返幂等）。返回被恢复的卡数。
 */
export async function resumeCardsInBlocks(
  db: SqlRunner, userId: string, blockIds: readonly string[],
): Promise<number> {
  if (blockIds.length === 0) return 0
  const r = await db.execute<{ card_id: string }>(sql`
    update card_state
    set phase = case when jsonb_array_length(plan) > 0 then 'learning' else 'new' end,
        updated_at = now()
    where user_id = ${userId} and phase = 'paused'
      and card_id in (select id from cards where block_id in ${inList([...blockIds])})
    returning card_id`)
  return r.rows.length
}
