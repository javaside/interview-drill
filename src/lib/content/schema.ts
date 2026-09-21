import { z } from 'zod'
import type { CardType } from './types.js'

/** 按 cardType 分派的最少要点数。设计文档 §8.3 */
export const MIN_KEY_POINTS: Record<CardType, number> = {
  enumeration: 3,
  comparison: 3,
  sequence: 4,
  judgment: 2,
  atomic: 1,
}

export const MAX_KEY_POINTS = 6

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// 两个 schema 都是 .strict()。zod 默认会**静默剥离**未知字段，而 `retiredAt`
// 和 `movedFrom` 恰好是 §7 那套 id 守卫的两个放行开关，且都是可选的 ——
// 拼成 `retiredAT` 不会有任何信号，作者以为下线了，卡却继续出题给用户。

export const sourceSchema = z.object({
  kind: z.enum(['official-doc', 'source-code', 'rfc', 'jsr', 'spec']),
  url: z.string().url(),
  locator: z.string().min(1),
})

export const keyPointSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  source: sourceSchema,
  appliesTo: z.string().min(1).optional(),
  excludeAsDistractorFor: z.array(z.string()),
  confirmedIndependentOf: z.array(z.string()).default([]),
  verifiedAt: z.string().regex(ISO_DATE, 'verifiedAt 必须是 YYYY-MM-DD'),
  public: z.boolean(),
  order: z.number().int().positive().optional(),
  reasoning: z.string().min(1).optional(),
  movedFrom: z.string().optional(),
  retiredAt: z.string().regex(ISO_DATE).optional(),
}).strict()

export const cardSchema = z
  .object({
    id: z.string().min(1),
    blockId: z.string().min(1),
    relatedBlocks: z.array(z.string()),
    question: z.string().min(1),
    cardType: z.enum(['enumeration', 'comparison', 'sequence', 'judgment', 'atomic']),
    keyPoints: z.array(keyPointSchema).max(MAX_KEY_POINTS),
    detail: z.string(),
    followUps: z.array(z.string()),
    appliesTo: z.string().min(1),
    frequency: z.enum(['high', 'mid', 'low']),
    conclusion: z.enum(['yes', 'no', 'depends']).optional(),
    retiredAt: z.string().regex(ISO_DATE).optional(),
    movedFrom: z.string().optional(),
  })
  .strict()
  .superRefine((card, ctx) => {
    const min = MIN_KEY_POINTS[card.cardType]
    if (card.keyPoints.length < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['keyPoints'],
        message: `${card.cardType} 型至少需要 ${min} 条要点，实际 ${card.keyPoints.length} 条`,
      })
    }
    if (card.cardType === 'sequence') {
      card.keyPoints.forEach((kp, i) => {
        if (kp.order === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['keyPoints', i, 'order'],
            message: 'sequence 型的每条要点必须有 order —— 顺序就是这型题的答案',
          })
        }
      })
    }
    if (card.cardType === 'judgment' && card.conclusion === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conclusion'],
        message: 'judgment 型必须声明正确结论（yes/no/depends）' })
    }
    if (card.cardType !== 'judgment' && card.conclusion !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conclusion'],
        message: 'conclusion 仅 judgment 型允许' })
    }
  })
