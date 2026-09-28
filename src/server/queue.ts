import { sameBlockPoolOf } from '../lib/options/draw.js'
import type { OptionCard, OptionKeyPoint, DistractorPools } from '../lib/options/types.js'
import { prepareOptions } from '../lib/options/prepare.js'
import type { PreparedOptions } from '../lib/options/prepare.js'
import { crossBlockPoolFor, entitledCards } from '../lib/entitlement/entitlement.js'
import type { Entitlement } from '../lib/entitlement/entitlement.js'
import { schedule, reservedLoadOf } from '../lib/scheduler/schedule.js'
import type { QueueItem } from '../lib/scheduler/schedule.js'
import { addDays } from '../lib/scheduler/date.js'
import type { LocalDate } from '../lib/scheduler/date.js'
import { rat, cmpRat, compareCardId } from '../lib/scheduler/types.js'
import type { CardState } from '../lib/scheduler/types.js'
import { localDateOf } from './time.js'
import type { CardSnapshot, Settings } from './types.js'

/** CardSnapshot → OptionCard（lib/options 的最小输入投影） */
function toOptionCard(c: CardSnapshot): OptionCard {
  return { id: c.cardId, blockId: c.blockId, cardType: c.cardType, keyPoints: c.keyPoints }
}

/**
 * 大类值序列里 current 的下一项（循环）——neighbor 层的相邻大类。
 * 少于两个大类或 current 不在序列中 → undefined（neighbor 层空）。
 */
function neighborCategoryOf(categories: Map<string, string>, current: string): string | undefined {
  const seq = [...new Set(categories.values())]
  if (seq.length < 2) return undefined
  const i = seq.indexOf(current)
  if (i < 0) return undefined
  return seq[(i + 1) % seq.length]
}

/**
 * 唯一池装配入口（终审裁决）：全库唯一构造 DistractorPools 的地方。
 *
 * - sameBlock：目标块其他卡的要点（块已解锁，语料本来可见，**不过 public**）。
 * - crossBlock：同大类**其他块**的要点，过 crossBlockPoolFor——免费层只留 public，
 *   付费层全量（终审裁决：免费用户 crossBlock 必过 public）。
 * - neighbor：相邻大类的要点，**同样**过 crossBlockPoolFor——免费层只留 public
 *   （终审裁决：neighbor 层也必过 public，两层都不得泄露未解锁语料）。
 *
 * 互斥（excludeAsDistractorFor）过滤不在这里做——drawDistractors 负责（职责分离）。
 */
export function buildDistractorPools(
  target: CardSnapshot,
  all: CardSnapshot[],
  ent: Entitlement,
  categories: Map<string, string>,
): DistractorPools {
  const optionCards = all.map(toOptionCard)
  const sameBlock = sameBlockPoolOf(toOptionCard(target), optionCards)

  const targetCategory = categories.get(target.blockId)
  const neighborCategory = targetCategory === undefined
    ? undefined
    : neighborCategoryOf(categories, targetCategory)

  // 同大类其他块（排除目标块自身——同块层已覆盖，不重复）的全部要点
  const crossRaw: OptionKeyPoint[] = []
  const neighborRaw: OptionKeyPoint[] = []
  for (const c of all) {
    if (c.blockId === target.blockId) continue
    const cat = categories.get(c.blockId)
    if (cat === undefined) continue
    if (cat === targetCategory) crossRaw.push(...c.keyPoints)
    else if (neighborCategory !== undefined && cat === neighborCategory) neighborRaw.push(...c.keyPoints)
  }

  return {
    sameBlock,
    crossBlock: crossBlockPoolFor(ent, crossRaw),
    neighbor: crossBlockPoolFor(ent, neighborRaw),
  }
}

export type DailyPayload = {
  today: LocalDate
  mode: 'sprint' | 'maintenance'
  /** 就绪日已过期（R<0）——UI 应提示「已回到常备模式，可更新日期」（spec §5.2 ①，此前算了就扔） */
  needsDateUpdate: boolean
  queue: QueueItem[]
  /** PreparedOptions 含顶层 degradedTo——server 对 'neighbor' 记告警日志（终审裁决） */
  prepared: PreparedOptions[]
  /** 屏①/屏② 渲染所需的展示元数据（与 queue 一一对应，只含队列内卡自身要点） */
  cards: CardView[]
  progress: { done: number; total: number }
  /** 今天答错过的不同卡数——「再练错题」入口显隐（v2：初学阶段的密集重练权还给用户） */
  missesToday: number
}

/**
 * 屏①/屏② 展示元数据（不含判分口径）：题面/块名/频度供屏① 渲染，
 * keyPoints 文本供屏② 染色与错勾归属（把 distractorKeyPointIds 映射回归属块）。
 */
export type CardView = {
  cardId: string
  blockId: string
  blockName: string
  cardType: CardSnapshot['cardType']
  frequency: CardSnapshot['frequency']
  question: string
  conclusion?: 'yes' | 'no' | 'depends'
  keyPoints: Array<{ id: string; text: string }>
  /** 题解讲解（先学后练：屏①「先看讲解」的材料，对不会的用户先学再答） */
  detail: string
}

/** CardSnapshot → SchedulableCard（schedule 的最小输入；保留 blockId 供 entitlement 过滤） */
const toSchedulable = (c: CardSnapshot) => ({ id: c.cardId, blockId: c.blockId, frequency: c.frequency })

export type DailyPayloadDeps = {
  userId: string
  loadSettings(): Promise<{ settings: Settings & { timezone: string }; ent: Entitlement }>
  loadCards(): Promise<{ cards: CardSnapshot[]; categories: Map<string, string> }>
  /** 偏移域卡状态（plan 已由 adapter diffDays 转相对 today） */
  loadStates(): Promise<CardState[]>
  persistPlans(plans: Array<{ cardId: string; plan: LocalDate[] }>): Promise<void>
  ensureDailySession(today: LocalDate, queueSize: number): Promise<number>
  countTodayDone(today: LocalDate): Promise<number>
  countTodayMisses(today: LocalDate): Promise<number>
  serverNowMs: number
}

/**
 * 今日队列装配（§6/§4.3）：entitlement 过滤 → schedule（plan-once，含 reservedLoad
 * ——已有计划卡占容量，§5.1）→ 新计划转回绝对日期落盘 → 每张队列卡预生成 K 份变体
 * → daily_session 定分母。deps 注入全部 IO（集成测试经 pglite）。
 *
 * 变体复现口径：预生成用**取队列时**的 s 与 reviewCount（与 /api/sync 回放的
 * 复现契约一致，见 replay.variantAt）。
 */
export async function buildDailyPayload(deps: DailyPayloadDeps): Promise<DailyPayload> {
  const { settings, ent } = await deps.loadSettings()
  const today = localDateOf(deps.serverNowMs, settings.timezone)
  const { cards, categories } = await deps.loadCards()

  // 先按 entitlement 过滤（需 blockId），再投影为 SchedulableCard
  const entitled = entitledCards(ent, cards.map(toSchedulable))
  const states = await deps.loadStates()

  const result = schedule(
    entitled.map(c => ({ id: c.id, frequency: c.frequency })),
    states,
    settings.readyByDate,
    settings.dailyCapacity,
    today,
    reservedLoadOf(states),   // §5.1：已有计划的卡（含已消费剩余项）占容量
  )

  // 新计划落盘（偏移域 → 绝对日期）
  if (result.plans.size > 0) {
    await deps.persistPlans([...result.plans].map(([cardId, offsets]) => ({
      cardId, plan: offsets.map(o => addDays(today, o)),
    })))
  }

  // 预生成：K = 本次新计划长度，否则存量剩余计划长度（fresh 卡走新计划——阶梯 5-6 项）
  const stateByCard = new Map(states.map(s => [s.cardId, s] as const))
  const cardByCard = new Map(cards.map(c => [c.cardId, c] as const))
  const prepared: PreparedOptions[] = result.todayQueue.map(({ cardId }) => {
    const card = cardByCard.get(cardId)!
    const st = stateByCard.get(cardId)
    const pools = buildDistractorPools(card, cards, ent, categories)
    const k = result.plans.get(cardId)?.length ?? st?.plan.length ?? 1
    return prepareOptions(
      toOptionCard(card), pools, st?.s ?? rat(0, 1), deps.userId, st?.reviewCount ?? 0, Math.min(k, 6),
    )
  })

  const total = await deps.ensureDailySession(today, result.todayQueue.length)
  const done = await deps.countTodayDone(today)
  const missesToday = await deps.countTodayMisses(today)

  // 屏①/屏② 展示元数据投影（只投队列内卡自身要点——免费用户不泄露未解锁块语料）
  const cardViews: CardView[] = result.todayQueue.map(({ cardId }) => {
    const c = cardByCard.get(cardId)!
    return {
      cardId,
      blockId: c.blockId,
      blockName: c.blockName ?? '',
      cardType: c.cardType,
      frequency: c.frequency,
      question: c.question ?? '',
      ...(c.conclusion ? { conclusion: c.conclusion } : {}),
      keyPoints: c.keyPoints.map(k => ({ id: k.id, text: k.text })),
      detail: c.detail ?? '',
    }
  })

  return {
    today, mode: result.mode, needsDateUpdate: result.needsDateUpdate,
    queue: result.todayQueue, prepared, cards: cardViews,
    progress: { done, total }, missesToday,
  }
}

/**
 * 自由刷题（v2 用户主权）：按块构造练习载荷——**不看排期**，块的解锁卡全进
 * （逾期/到期在前，其余按掌握度升序——最不会的先刷），上限 dailyCapacity。
 * 练习不落 daily_session 分母（不干扰正式排期的今日进度）；判分照常走
 * transitionCard（提前消费未来复习项、按表现进退档）——算法是参谋不是门卫。
 */
export async function practiceQueue(
  deps: DailyPayloadDeps, userId: string, blockId: string,
): Promise<DailyPayload> {
  const { settings, ent } = await deps.loadSettings()
  const today = localDateOf(deps.serverNowMs, settings.timezone)
  const { cards, categories } = await deps.loadCards()

  // 免费墙：只刷解锁块
  const inBlock = entitledCards(ent, cards.map(toSchedulable))
    .filter(c => c.blockId === blockId)
  const states = await deps.loadStates()
  const stateByCard = new Map(states.map(s => [s.cardId, s] as const))
  const cardByCard = new Map(cards.map(c => [c.cardId, c] as const))

  // 排序：逾期/今天到期在前 → s 升序（最不会的先）→ cardId
  const ordered = [...inBlock].sort((a, b) => {
    const sa = stateByCard.get(a.id)
    const sb = stateByCard.get(b.id)
    const rankOf = (st: typeof sa): number => {
      if (st === undefined) return 1
      const hasDue = st.plan.some(d => d <= 0)
      if (hasDue) return 0
      return 1
    }
    const ra = rankOf(sa), rb = rankOf(sb)
    if (ra !== rb) return ra - rb
    return (
      cmpRat(sa?.s ?? rat(0, 1), sb?.s ?? rat(0, 1)) ||
      compareCardId(a.id, b.id)
    )
  }).slice(0, settings.dailyCapacity)

  const queue = ordered.map(c => ({ cardId: c.id, reason: 'due' as const }))
  const prepared: PreparedOptions[] = ordered.map(c => {
    const card = cardByCard.get(c.id)!
    const st = stateByCard.get(c.id)
    const pools = buildDistractorPools(card, cards, ent, categories)
    return prepareOptions(
      toOptionCard(card), pools, st?.s ?? rat(0, 1), userId, st?.reviewCount ?? 0, 1,
    )
  })
  const cardViews: CardView[] = ordered.map(c => {
    const card = cardByCard.get(c.id)!
    return {
      cardId: c.id,
      blockId: card.blockId,
      blockName: card.blockName ?? '',
      cardType: card.cardType,
      frequency: card.frequency,
      question: card.question ?? '',
      ...(card.conclusion ? { conclusion: card.conclusion } : {}),
      keyPoints: card.keyPoints.map(k => ({ id: k.id, text: k.text })),
      detail: card.detail ?? '',
    }
  })

  const missesToday = await deps.countTodayMisses(today)
  return {
    today, mode: settings.readyByDate === null ? 'maintenance' : 'sprint', needsDateUpdate: false,
    queue, prepared, cards: cardViews,
    progress: { done: 0, total: queue.length }, missesToday,
  }
}
