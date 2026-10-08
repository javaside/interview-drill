import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { ulid } from 'ulid'
import { rat } from '../../lib/scheduler/types.js'
import type { CardState, Rational } from '../../lib/scheduler/types.js'
import { diffDays } from '../../lib/scheduler/date.js'
import type { LocalDate } from '../../lib/scheduler/date.js'
import { makeFreeEntitlement, makePaidEntitlement, FREE_BLOCK_LIMIT } from '../../lib/entitlement/entitlement.js'
import type { Entitlement } from '../../lib/entitlement/entitlement.js'
import { accessStateOf, expiryAction } from '../../lib/entitlement/expiry.js'
import type { AccessState } from '../../lib/entitlement/expiry.js'
import { PASS_DAYS } from '../../lib/billing/order.js'
import type { OrderStatus } from '../../lib/billing/order.js'
import { ALGO_VERSION } from '../version.js'
import { localDateOf } from '../time.js'
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

export type UserSettingsRow = Settings & {
  timezone: string
  /** 遗留列：'paid' = 买过（含已过期）。**不用于判定权限**，见 lib/entitlement/expiry.ts */
  plan: 'free' | 'paid'
  /** 勾选集 = 排期范围。宽限期内语义见 selectionBlockIdsOf */
  freeBlockIds: string[]
  /** 通行证到期时刻（null = 从未付费）——权限判定的唯一依据 */
  paidUntil: Date | null
  /** 宽限截止（本地日）。null = 未结算 */
  graceUntil: LocalDate | null
  /** 到期结算冻结的宽限块 */
  graceBlockIds: string[]
  trackId: string | null
}

type RawSettingsRow = {
  ready_by_date: string | null; daily_capacity: number; timezone: string
  plan: string; free_block_ids: string[]; track_id: string | null
  paid_until: string | null; grace_until: string | null; grace_block_ids: string[] | null
}

/** 纯读，不做任何结算——供 loadSettings 包装 */
async function readSettingsRow(db: SqlRunner, userId: string): Promise<UserSettingsRow> {
  const r = await db.execute<RawSettingsRow>(sql`
    select ready_by_date, daily_capacity, timezone, plan, free_block_ids, track_id,
           paid_until, grace_until, grace_block_ids
    from user_settings where user_id = ${userId}`)
  const row = r.rows[0]
  if (row === undefined) throw new Error(`用户设置缺失：${userId}`)
  return {
    readyByDate: row.ready_by_date,
    dailyCapacity: row.daily_capacity,
    timezone: row.timezone,
    plan: row.plan === 'paid' ? 'paid' : 'free',
    freeBlockIds: row.free_block_ids ?? [],
    paidUntil: row.paid_until === null ? null : new Date(row.paid_until),
    graceUntil: row.grace_until ?? null,
    graceBlockIds: row.grace_block_ids ?? [],
    trackId: row.track_id,
  }
}

/**
 * 读设置 + **惰性结算通行证到期**（user_settings → 内存设置，readyByDate 可空 = 维持模式）。
 *
 * 到期后的第一次读取会把宽限快照落库（见 lib/entitlement/expiry.ts 的「为什么要结算」）。
 * 只对「已到期且未结算」的行多一次 card_state 查询 + 一次 UPDATE，其余用户零开销。
 * 并发安全：结算 UPDATE 带 `grace_until is null` 守卫，重复执行 no-op。
 *
 * ⚠️ 本函数**可能写库**——所有读设置的地方都会成为结算触发点，这是有意的
 * （入口多才好保证「谁先来看谁结算」）。
 */
export async function loadSettings(
  db: SqlRunner, userId: string, nowMs: number = Date.now(),
): Promise<UserSettingsRow> {
  const row = await readSettingsRow(db, userId)
  const today = localDateOf(nowMs, row.timezone)
  const unpaid = row.paidUntil !== null && row.paidUntil.getTime() <= nowMs
  const scheduled = unpaid && row.graceUntil === null
    ? await loadScheduledLastDates(db, userId)
    : []
  const action = expiryAction({
    paidUntilMs: row.paidUntil?.getTime() ?? null,
    graceUntil: row.graceUntil,
    nowMs,
    today,
    readyByDate: row.readyByDate,
    selection: row.freeBlockIds,
    scheduled,
  })
  if (action.kind === 'none') return row

  if (action.kind === 'settle') {
    await db.execute(sql`
      update user_settings
      set grace_until = ${action.graceUntil},
          grace_block_ids = ${JSON.stringify(action.graceBlockIds)}::jsonb,
          free_block_ids = ${JSON.stringify(action.freeBlockIds)}::jsonb,
          updated_at = now()
      where user_id = ${userId} and grace_until is null`)
    return {
      ...row,
      graceUntil: action.graceUntil,
      graceBlockIds: action.graceBlockIds,
      freeBlockIds: action.freeBlockIds,
    }
  }

  await db.execute(sql`
    update user_settings
    set free_block_ids = ${JSON.stringify(action.freeBlockIds)}::jsonb, updated_at = now()
    where user_id = ${userId}`)
  return { ...row, freeBlockIds: action.freeBlockIds }
}

/**
 * 到期结算用：仍有未完成排期的卡所属块 + 该块内最晚排期日。
 * plan 是 'YYYY-MM-DD' 的 jsonb 数组，ISO 日期按字典序 max 即正确。
 * 按 block_id 升序返回——保证 expiryAction 的「宽限块前 2 个进免费层」可预测、可测。
 */
export async function loadScheduledLastDates(
  db: SqlRunner, userId: string,
): Promise<Array<{ blockId: string; lastPlannedDate: LocalDate }>> {
  const r = await db.execute<{ block_id: string; last_date: string }>(sql`
    select c.block_id, max(d.day) as last_date
    from card_state s
    join cards c on c.id = s.card_id
    cross join lateral jsonb_array_elements_text(s.plan) as d(day)
    where s.user_id = ${userId} and s.plan <> '[]'::jsonb
    group by c.block_id
    order by c.block_id`)
  return r.rows.map(x => ({ blockId: x.block_id, lastPlannedDate: x.last_date }))
}

export type TrackRow = { id: string; name: string; tagline: string; blockIds: string[] }

/** 岗位包全表（配置数据，量级是个位数） */
export async function loadTracks(db: SqlRunner): Promise<TrackRow[]> {
  const r = await db.execute<{ id: string; name: string; tagline: string; block_ids: string[] }>(sql`
    select id, name, tagline, block_ids from tracks order by id`)
  return r.rows.map(t => ({ id: t.id, name: t.name, tagline: t.tagline, blockIds: t.block_ids ?? [] }))
}

/** 档位：paid（有效期内）/ grace（宽限期内）/ free。UI 与配额读它，别读遗留的 plan 列 */
export function accessStateOfRow(row: UserSettingsRow, nowMs: number): AccessState {
  return accessStateOf({
    paidUntilMs: row.paidUntil?.getTime() ?? null,
    graceUntil: row.graceUntil,
    nowMs,
    today: localDateOf(nowMs, row.timezone),
  })
}

/**
 * 配额 / 勾选档位口径：宽限期内**仍算 'paid'**（用户 2026-10-02 拍板：宽限期 AI 配额
 * 按付费档；设置页宽限期内也可任意勾选）。
 * 与 entitlementOf 的全量放行**不是一回事**——别混用。
 */
export function planOf(row: UserSettingsRow, nowMs: number): 'free' | 'paid' {
  return accessStateOfRow(row, nowMs) === 'free' ? 'free' : 'paid'
}

/**
 * UserSettingsRow → Entitlement。付费（有效期内）= 全量；否则 free 勾选 ∪ 宽限块。
 *
 * 读取侧对勾选取前 FREE_BLOCK_LIMIT 个是**兜底截断**：写入侧（applyBlockSelection
 * 与到期结算）已强校验，这里只保证任何历史脏行都不会让 makeFreeEntitlement 抛错
 * 把整页 500（该故障类型本项目真实发生过两次，见 AGENTS.md 免费墙条目）。
 */
export function entitlementOf(row: UserSettingsRow, nowMs: number): Entitlement {
  if (accessStateOfRow(row, nowMs) === 'paid') return makePaidEntitlement()
  return makeFreeEntitlement(
    row.freeBlockIds.slice(0, FREE_BLOCK_LIMIT),
    row.graceBlockIds,
  )
}

/**
 * 剩余天数（向上取整、至少 1）——**全站唯一实现**，导航 chip 与 /upgrade 共用，
 * 别在页面里各算一遍（两处算不一致就会出现「导航说 12 天、页面说 13 天」）。
 * 至少 1 天的理由：还剩 3 小时时显示「0 天」，读起来像已过期。
 * 非 paid（free/grace）返回 null——已过期的人不该看到「还剩 0 天」。
 */
export function daysLeftOf(row: UserSettingsRow, nowMs: number): number | null {
  if (accessStateOfRow(row, nowMs) !== 'paid' || row.paidUntil === null) return null
  return Math.max(1, Math.ceil((row.paidUntil.getTime() - nowMs) / 86_400_000))
}

/**
 * 排期范围（勾选集）口径：
 * - paid / free：已保存勾选（空即空，无隐藏兜底）
 * - **宽限期：勾选 ∪ 宽限块**——否则勾选被收敛到 2 块后，剩下的宽限排期会被
 *   勾选集过滤掉，「让在期排的题跑完」当场失效（2026-10-02 查证）。
 *   设置页的读与写两侧都必须用本函数，否则保存设置会把宽限排期当「减块」pause 掉。
 */
export function selectionBlockIdsOf(row: UserSettingsRow, nowMs: number): string[] {
  if (accessStateOfRow(row, nowMs) !== 'grace') return [...row.freeBlockIds]
  return [...new Set([...row.freeBlockIds, ...row.graceBlockIds])]
}

/** cards + key_points → CardSnapshot（判分/装配所需的最小投影） */
export async function loadCardSnapshots(db: SqlRunner, cardIds: string[]): Promise<Map<string, CardSnapshot>> {
  const out = new Map<string, CardSnapshot>()
  if (cardIds.length === 0) return out
  const cards = await db.execute<{
    id: string; block_id: string; card_type: string; frequency: string; conclusion: string | null
    question: string; detail: string | null; block_name: string | null
  }>(sql`
    select c.id, c.block_id, c.card_type, c.frequency, c.conclusion, c.question, c.detail, b.name as block_name
    from cards c left join blocks b on b.id = c.block_id
    where c.id in ${inList(cardIds)}`)
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
      question: c.question,
      keyPoints: kpByCard.get(c.id) ?? [],
      ...(c.block_name ? { blockName: c.block_name } : {}),
      ...(c.conclusion ? { conclusion: c.conclusion as CardSnapshot['conclusion'] } : {}),
      ...(c.detail ? { detail: c.detail } : {}),
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

/**
 * 全块 + 未退役卡计数（知识地图题量，§4.4）。left join 保证无卡的块也出现（cardCount=0），
 * 按 blockId 升序确定输出。
 */
export async function loadBlocks(
  db: SqlRunner,
): Promise<Array<{ blockId: string; blockName: string; category: string; cardCount: number }>> {
  const r = await db.execute<{ id: string; name: string; category: string; n: number }>(sql`
    select b.id, b.name, b.category, count(c.id)::int as n
    from blocks b left join cards c on c.block_id = b.id and c.retired_at is null
    group by b.id order by b.id`)
  return r.rows.map(row => ({
    blockId: row.id, blockName: row.name, category: row.category, cardCount: row.n,
  }))
}

/**
 * 邀请码台账（后台 /backstage）：全部码按铸造时间倒序。明文不可逆不返回，
 * codeHash 前 8 位仅作行识别。已兑换行带兑换者（login 优先，存量空 login 兜底
 * github 数字 id）。
 */
export async function listInviteCodes(
  db: SqlRunner,
): Promise<Array<{
  id: string; hashPrefix: string; note: string | null
  createdAt: string; usedByLogin: string | null; usedByGithubId: string | null; usedAt: string | null
}>> {
  const r = await db.execute<{ id: string; code_hash: string; note: string | null; created_at: string; used_by_login: string | null; used_by_github_id: string | null; used_at: string | null }>(sql`
    select ic.id, ic.code_hash, ic.note, ic.created_at,
           u.login as used_by_login, u.github_id as used_by_github_id, ic.used_at
    from invite_codes ic left join users u on u.id = ic.used_by
    order by ic.created_at desc`)
  return r.rows.map(row => ({
    id: row.id,
    hashPrefix: row.code_hash.slice(0, 8),
    note: row.note,
    createdAt: row.created_at,
    usedByLogin: row.used_by_login,
    usedByGithubId: row.used_by_github_id,
    usedAt: row.used_at,
  }))
}

/** 公开题目页视图（§7 SEO 边界）：题面 + 块名 + 仅 public 要点 + 全部活要点数；blockId 仅供 demo 存在性判定 */
export interface PublicCard {
  cardId: string
  blockId: string
  question: string
  blockName: string
  publicKeyPoints: Array<{ id: string; text: string }>
  totalKeyPoints: number
}

/**
 * 公开题目页数据（§7「不做 cloaking」的服务端泄露边界）。三条查询：
 * 1) cards join blocks 取题面 + 块名（卡不存在或已退役 → null）；
 * 2) key_points **只选 public 要点**（`public = true and retired_at is null`，按 order/id 稳定序）
 *    ——非 public 要点的 text 在查询层就被切断，绝不进入返回值；
 * 3) count(*) 全部活要点（`retired_at is null`）作 totalKeyPoints（分母，不含任何私有文本）。
 */
export async function loadPublicCard(db: SqlRunner, cardId: string): Promise<PublicCard | null> {
  const cardRes = await db.execute<{ question: string; block_id: string; block_name: string | null }>(sql`
    select c.question, c.block_id, b.name as block_name
    from cards c left join blocks b on b.id = c.block_id
    where c.id = ${cardId} and c.retired_at is null`)
  const card = cardRes.rows[0]
  if (card === undefined) return null

  const kpRes = await db.execute<{ id: string; text: string }>(sql`
    select id, text from key_points
    where card_id = ${cardId} and public = true and retired_at is null
    order by "order" asc nulls last, id asc`)

  const totalRes = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from key_points
    where card_id = ${cardId} and retired_at is null`)

  return {
    cardId,
    blockId: card.block_id,
    question: card.question,
    blockName: card.block_name ?? '',
    publicKeyPoints: kpRes.rows.map(r => ({ id: r.id, text: r.text })),
    totalKeyPoints: totalRes.rows[0]?.n ?? 0,
  }
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

/**
 * 今日进度分子（§6）：当天已刷的不同卡数
 */
export async function countTodayDone(
  db: SqlRunner, userId: string, today: LocalDate,
): Promise<number> {
  const r = await db.execute<{ n: number }>(sql`
    select count(distinct card_id)::int as n from review_log
    where user_id = ${userId} and local_date = ${today}`)
  return r.rows[0]?.n ?? 0
}

/**
 * 今天答错过（判分口径 2·correct < total，即 failed）的不同卡数——
 * 「再练错题」入口的显隐依据（v2：初学阶段的密集重练权还给用户）。
 */
export async function countTodayMisses(
  db: SqlRunner, userId: string, today: LocalDate,
): Promise<number> {
  const r = await db.execute<{ n: number }>(sql`
    select count(distinct card_id)::int as n from review_log
    where user_id = ${userId} and local_date = ${today}
      and 2 * correct_checked < key_points_total`)
  return r.rows[0]?.n ?? 0
}

/**
 * 再练错题（v2）：把「今天答错过、且下次复习排在今天之后」的卡拉回今天——
 * plan 首项改写为 today（ISO 字符串字典序 = 时间序）。用户主动触发，不是自动回队，
 * 不构成同日死循环；提前消费该项后，间隔从今天按表现重新进退。
 * 返回拉回的卡数。
 */
export async function requeueTodaysMissedCards(
  db: SqlRunner, userId: string, today: LocalDate,
): Promise<number> {
  const r = await db.execute<{ card_id: string }>(sql`
    update card_state
    set plan = jsonb_set(plan, '{0}', to_jsonb(${today}::text)), updated_at = now()
    where user_id = ${userId}
      and jsonb_array_length(plan) > 0
      and plan->>0 > ${today}::text
      and card_id in (
        select distinct card_id from review_log
        where user_id = ${userId} and local_date = ${today}
          and 2 * correct_checked < key_points_total
      )
    returning card_id`)
  return r.rows.length
}

/**
 * 全部再来一遍（v2 用户主权）：把「今天刷过、且下次复习排在今天之后」的卡
 * **全部**拉回今天——含答对的。刷过一次 ≠ 记住，重复到记住为止的权力在用户；
 * 每次作答照常计分进退档。返回拉回的卡数。
 */
export async function requeueTodaysCards(
  db: SqlRunner, userId: string, today: LocalDate,
): Promise<number> {
  const r = await db.execute<{ card_id: string }>(sql`
    update card_state
    set plan = jsonb_set(plan, '{0}', to_jsonb(${today}::text)), updated_at = now()
    where user_id = ${userId}
      and jsonb_array_length(plan) > 0
      and plan->>0 > ${today}::text
      and card_id in (
        select distinct card_id from review_log
        where user_id = ${userId} and local_date = ${today}
      )
    returning card_id`)
  return r.rows.length
}

/** 设置变更（§5.5 条件 2/3）：只更新传入字段，其余不动 */
export async function updateUserSettings(
  db: SqlRunner, userId: string,
  next: { readyByDate?: LocalDate | null; dailyCapacity?: number; trackId?: string | null },
): Promise<void> {
  const sets: SQL[] = []
  if ('readyByDate' in next) sets.push(sql`ready_by_date = ${next.readyByDate ?? null}`)
  if (next.dailyCapacity !== undefined) sets.push(sql`daily_capacity = ${next.dailyCapacity}`)
  if ('trackId' in next) sets.push(sql`track_id = ${next.trackId ?? null}`)
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

/**
 * 存量 done 卡复活（v2 迁移，计划 6 Task 4）：v1 的自动毕业把「冲刺收口」误当
 * 「掌握」，done 卡永久退休无复活路径。保存设置时按解锁块范围复活为 learning
 * （phaseIndex/s 保留——掌握度与维持档位记忆不丢），并**补种滚动计划**
 * [today + MAINTAIN_INTERVALS[k]]——常备模式不生成计划，复活后 plan 仍空的话
 * 卡永不进队列（复活等于没复活，评审耦合点）。sprint 路径无需补种：fresh 判定
 * 收 plan 空的卡，clearActivePlans + buildDailyPayload 会重排。
 * paused 不动（减块语义独立）。v2 起 done 不再自动产生。
 */
export async function reviveDoneCards(
  db: SqlRunner, userId: string, blockIds: readonly string[], today: LocalDate,
): Promise<number> {
  if (blockIds.length === 0) return 0
  const r = await db.execute<{ card_id: string }>(sql`
    update card_state set
      phase = 'learning',
      plan = to_jsonb(array[to_char(${today}::date + (case phase_index
        when 0 then 1 when 1 then 3 when 2 then 7 when 3 then 15
        when 4 then 30 when 5 then 60 else 120 end), 'YYYY-MM-DD')]),
      updated_at = now()
    where user_id = ${userId} and phase = 'done'
      and card_id in (select id from cards where block_id in ${inList([...blockIds])})
    returning card_id`)
  return r.rows.length
}

/** 订单行（§10 付费解锁 · 计划 5）：status 读取自立库时刻，映射回 OrderStatus */
export type OrderRow = {
  id: string
  userId: string
  amountCents: number
  status: OrderStatus
  gateway: string
  gatewayTxnId: string | null
  paidAt: Date | null
}

/** 建单（下单即 pending，status 走列默认值；金额由服务端决定，不接受调用方传状态） */
export async function insertOrder(
  db: SqlRunner, o: { id: string; userId: string; amountCents: number; gateway: string },
): Promise<void> {
  await db.execute(sql`
    insert into orders (id, user_id, amount_cents, gateway)
    values (${o.id}, ${o.userId}, ${o.amountCents}, ${o.gateway})`)
}

/** 按 id 取订单（不存在 → null）；paid_at 兼容 string/Date 驱动差异归一为 Date */
export async function loadOrder(db: SqlRunner, orderId: string): Promise<OrderRow | null> {
  const r = await db.execute<{
    id: string; user_id: string; amount_cents: number; status: string
    gateway: string; gateway_txn_id: string | null; paid_at: string | Date | null
  }>(sql`
    select id, user_id, amount_cents, status, gateway, gateway_txn_id, paid_at
    from orders where id = ${orderId}`)
  const row = r.rows[0]
  if (row === undefined) return null
  return {
    id: row.id,
    userId: row.user_id,
    amountCents: row.amount_cents,
    status: row.status as OrderStatus,
    gateway: row.gateway,
    gatewayTxnId: row.gateway_txn_id,
    paidAt: row.paid_at === null ? null : new Date(row.paid_at),
  }
}

/** 订单置 paid：写网关流水号与支付时刻（仅在履约分支调用——状态合法性由纯核 fulfillmentDecision 保证） */
export async function markOrderPaid(
  db: SqlRunner, orderId: string, gatewayTxnId: string,
): Promise<void> {
  await db.execute(sql`
    update orders set status = 'paid', gateway_txn_id = ${gatewayTxnId}, paid_at = now()
    where id = ${orderId}`)
}

/** 订单迁移到指定终态（failed/expired 回调）；paid 走 markOrderPaid（带流水号与时刻） */
export async function markOrderStatus(
  db: SqlRunner, orderId: string, status: OrderStatus,
): Promise<void> {
  await db.execute(sql`
    update orders set status = ${status} where id = ${orderId}`)
}

/**
 * 延长通行证（§10.1 v3 唯一解锁写入路径：支付履约与邀请码兑换共用）：
 * 从「现有到期日与当下较晚者」+ PASS_DAYS，**叠加不覆盖**（用户拍板）——
 * 提前续期的用户不会亏掉剩余时间；已过期很久的用户也不会被「倒扣」到过去。
 *
 * 同时清空结算态（重新付费 → 宽限作废）与勾选（解锁不改变排期范围，需回设置重勾，
 * 与既有语义一致）。plan 同步写 'paid'：遗留列，仅为 app 回滚时旧代码能读到。
 *
 * 时间参数走 ISO 字符串 + 显式 cast（coalesce/greatest 都是 timestamptz 域），
 * PGlite 与真 PG 都能吃；别改成 `now() + interval`——那样测不了时间旅行。
 */
export async function extendPass(db: SqlRunner, userId: string, nowMs: number = Date.now()): Promise<void> {
  const nowIso = new Date(nowMs).toISOString()
  await db.execute(sql`
    update user_settings
    set plan = 'paid',
        paid_until = greatest(coalesce(paid_until, ${nowIso}::timestamptz), ${nowIso}::timestamptz)
                     + make_interval(days => ${PASS_DAYS}),
        grace_until = null,
        grace_block_ids = '[]'::jsonb,
        free_block_ids = '[]'::jsonb,
        updated_at = now()
    where user_id = ${userId}`)
}
