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
import { rat } from '../lib/scheduler/types.js'
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
  queue: QueueItem[]
  /** PreparedOptions 含顶层 degradedTo——server 对 'neighbor' 记告警日志（终审裁决） */
  prepared: PreparedOptions[]
  /** 屏①/屏② 渲染所需的展示元数据（与 queue 一一对应，只含队列内卡自身要点） */
  cards: CardView[]
  progress: { done: number; total: number }
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
    }
  })

  return { today, mode: result.mode, queue: result.todayQueue, prepared, cards: cardViews, progress: { done, total } }
}
