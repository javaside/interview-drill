import { hashSeed, seedRng, shuffle } from './rng.js'
import type { Rng } from './rng.js'
import { drawDistractors } from './draw.js'
import type { Degradation } from './draw.js'
import { ATOMIC_OPTIONS_TOTAL, OPTIONS_TOTAL } from './types.js'
import type { DistractorPools, OptionCard, OptionKeyPoint, Rational } from './types.js'

export type PreparedVariant = {
  /** 选项文本，已按 rng 打乱（sequence 例外：哨兵 seed 洗出的固定呈现序） */
  optionTexts: string[]
  /**
   * 正确选项的下标——判分用，客户端离线判分需要（§4.3）。
   * 多选型 = 正确项在呈现中的位置集合；sequence = 按 canonical 顺序读出的
   * 呈现下标序列（见 buildVariant 的 sequence 分支）
   */
  correctIndices: number[]
  /** 被抽中的干扰项要点 id——只回传记录供复现，不用于渲染（§4.3） */
  distractorKeyPointIds: string[]
}

export type PreparedOptions = {
  cardId: string
  /**
   * 聚合降级标记（终审 Ruling）：任一变体的抽取走了相邻大类兜底即
   * 'neighbor'——server 只看一个字段就知道要不要记告警日志，不必翻 K 份
   * 变体。variants 内部结构不动。
   */
  degradedTo: Degradation
  /** K 份，对应该卡接下来 K 次复习（§4.3 服务端预生成、随队列下发） */
  variants: PreparedVariant[]
}

/**
 * 活要点校验（终审：防退役清空正确项）。要点退役（§7 tombstone）后过滤可能
 * 把正确项清空、或抽走 sequence 的 order 依据——静默生成空选项集/无答案排序题
 * 比构建期报错更糟，这里 fail fast，消息带 cardId 与 cardType 供内容侧定位。
 * - atomic：≥1 条活要点（内容约定 atomic 写 1 条，首条即正确项）
 * - 其余型：≥1 条活要点
 * - sequence：活要点必须全部有 order（顺序就是这型题的答案）
 */
function assertLiveKeyPoints(card: OptionCard, live: OptionKeyPoint[]): void {
  const hint = `cardId=${card.id}, cardType=${card.cardType}`
  if (live.length < 1) {
    throw new Error(`活要点不足（${hint}）：过滤退役要点后剩 0 条，正确项被退役清空`)
  }
  if (card.cardType === 'sequence') {
    const missing = live.filter(kp => kp.order === undefined).map(kp => kp.id)
    if (missing.length > 0) {
      throw new Error(`sequence 活要点缺 order（${hint}）：${missing.join(', ')}`)
    }
  }
}

/**
 * 预生成选项集（§4.3）。第 i 份变体的 rng 由 (userId, cardId,
 * reviewIndexBase + i) 派生——同一次复习永远同一套选项（可复现），
 * 下一次复习换一套（每次重抽，免疫"记住位置不记内容"）。
 *
 * 分型规则（§4.3 分型表）：
 * - enumeration / comparison / judgment：要点阶段多选，选项恒 9，
 *   干扰项 = 9 − 正确数。comparison 的"成对呈现/反转变体优先"是内容
 *   撰写期的约定（§4.3 记录在案），选项层与枚举同构；judgment 的结论
 *   三选（会/不会/取决于）是静态 UI 文案，不属数据层（见计划尾注）
 * - sequence：排序题。选项 = 本题全部活要点，呈现序由哨兵 seed 洗牌
 *   （终审 Ruling：呈现序非答案化，恒不等于 canonical 答案序，且跨
 *   K 份变体恒定——详见 buildVariant），无干扰项
 * - atomic：4 选 1，正确项 = 首条要点（内容侧约定 atomic 题写 1 条要点）
 */
export function prepareOptions(
  card: OptionCard,
  pools: DistractorPools,
  s: Rational,
  userId: string,
  reviewIndexBase: number,
  K: number,
): PreparedOptions {
  const live = card.keyPoints.filter(kp => !kp.retiredAt)
  assertLiveKeyPoints(card, live)
  const variants: PreparedVariant[] = []
  let degradedTo: Degradation = 'none'
  for (let i = 0; i < K; i++) {
    const rng = seedRng(hashSeed(userId, card.id, reviewIndexBase + i))
    const built = buildVariant(card, live, pools, s, rng, userId)
    variants.push(built.variant)
    if (built.degradedTo === 'neighbor') degradedTo = 'neighbor'
  }
  return { cardId: card.id, degradedTo, variants }
}

function buildVariant(
  card: OptionCard,
  correctPoints: OptionKeyPoint[],
  pools: DistractorPools,
  s: Rational,
  rng: Rng,
  userId: string,
): { variant: PreparedVariant; degradedTo: Degradation } {
  if (card.cardType === 'sequence') {
    const canonical = [...correctPoints].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const n = canonical.length
    const idx = Array.from({ length: n }, (_, i) => i)
    // 呈现序非答案化（终审 Ruling，最重要）：reviewIndex=-1 是保留哨兵，专用于
    // 呈现序——与复习次数无关，跨 K 份变体、跨天恒定（满足 spec"选项按固定
    // 顺序呈现"），同时随 (userId, cardId) 派生，不新增任何随机源（无 Math.random）。
    // 对下标洗牌而不是对 text 洗牌：p[k] = 呈现第 k 位读 canonical 第 p[k] 条，
    // 要点文本重复也不会错位。
    const presentRng = seedRng(hashSeed(userId, card.id, -1))
    let p = shuffle(idx, presentRng)
    if (p.every((c, k) => c === k)) {
      // 洗牌恰为恒等置换 → 循环左移 1 位兜底：n ≥ 2 时呈现序永不是答案本身
      // （n=1 退化为 = canonical，几何上无法不同；schema 要求 sequence ≥ 4 要点）
      p = idx.map((_, k) => (k + 1) % n)
    }
    const posOf = new Map(p.map((c, k) => [c, k] as const))
    return {
      variant: {
        optionTexts: p.map(c => canonical[c]!.text),
        // correctIndices 语义：按 canonical 顺序读出的呈现下标——
        // 例：呈现 [C,A,D,B]、canonical [A,B,C,D] → [1,3,0,2]；
        // 用户把呈现序排回 canonical 序即满分（scoreSequence 直接可用）
        correctIndices: idx.map(c => posOf.get(c)!),
        distractorKeyPointIds: [],
      },
      degradedTo: 'none',   // sequence 无抽取，不存在降级
    }
  }
  const total = card.cardType === 'atomic' ? ATOMIC_OPTIONS_TOTAL : OPTIONS_TOTAL
  const correctCount = card.cardType === 'atomic' ? 1 : correctPoints.length
  const { keyPoints: distractors, degradedTo } = drawDistractors(
    card,
    pools,
    total - correctCount,
    s,
    rng,
  )

  type Entry = { text: string; correct: boolean; distractorId?: string }
  const entries: Entry[] = [
    ...correctPoints.slice(0, correctCount).map(kp => ({ text: kp.text, correct: true })),
    ...distractors.map(kp => ({ text: kp.text, correct: false, distractorId: kp.id })),
  ]
  const arranged = shuffle(entries, rng)
  return {
    variant: {
      optionTexts: arranged.map(e => e.text),
      correctIndices: arranged.flatMap((e, i) => (e.correct ? [i] : [])),
      distractorKeyPointIds: arranged.flatMap(e => (e.distractorId ? [e.distractorId] : [])),
    },
    degradedTo,
  }
}
