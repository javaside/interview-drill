import { hashSeed, seedRng, shuffle } from './rng.js'
import type { Rng } from './rng.js'
import { drawDistractors } from './draw.js'
import { ATOMIC_OPTIONS_TOTAL, OPTIONS_TOTAL } from './types.js'
import type { DistractorPools, OptionCard, OptionKeyPoint, Rational } from './types.js'

export type PreparedVariant = {
  /** 选项文本，已按 rng 打乱（sequence 例外：固定顺序） */
  optionTexts: string[]
  /** 正确选项的下标——判分用，客户端离线判分需要（§4.3） */
  correctIndices: number[]
  /** 被抽中的干扰项要点 id——只回传记录供复现，不用于渲染（§4.3） */
  distractorKeyPointIds: string[]
}

export type PreparedOptions = {
  cardId: string
  /** K 份，对应该卡接下来 K 次复习（§4.3 服务端预生成、随队列下发） */
  variants: PreparedVariant[]
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
 * - sequence：排序题。选项 = 本题要点按 order 排列，**绝不打乱**（顺序
 *   即答案），无干扰项，correctIndices = [0..n-1] 表示呈现序即正确序
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
  const variants: PreparedVariant[] = []
  for (let i = 0; i < K; i++) {
    const rng = seedRng(hashSeed(userId, card.id, reviewIndexBase + i))
    variants.push(buildVariant(card, live, pools, s, rng))
  }
  return { cardId: card.id, variants }
}

function buildVariant(
  card: OptionCard,
  correctPoints: OptionKeyPoint[],
  pools: DistractorPools,
  s: Rational,
  rng: Rng,
): PreparedVariant {
  if (card.cardType === 'sequence') {
    const ordered = [...correctPoints].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    return {
      optionTexts: ordered.map(kp => kp.text),
      correctIndices: ordered.map((_, i) => i),
      distractorKeyPointIds: [],
    }
  }
  const total = card.cardType === 'atomic' ? ATOMIC_OPTIONS_TOTAL : OPTIONS_TOTAL
  const correctCount = card.cardType === 'atomic' ? 1 : correctPoints.length
  const { keyPoints: distractors } = drawDistractors(card, pools, total - correctCount, s, rng)

  type Entry = { text: string; correct: boolean; distractorId?: string }
  const entries: Entry[] = [
    ...correctPoints.slice(0, correctCount).map(kp => ({ text: kp.text, correct: true })),
    ...distractors.map(kp => ({ text: kp.text, correct: false, distractorId: kp.id })),
  ]
  const arranged = shuffle(entries, rng)
  return {
    optionTexts: arranged.map(e => e.text),
    correctIndices: arranged.flatMap((e, i) => (e.correct ? [i] : [])),
    distractorKeyPointIds: arranged.flatMap(e => (e.distractorId ? [e.distractorId] : [])),
  }
}
