import { bufferOf } from '../lib/scheduler/plan.js'
import { diffDays, addDays } from '../lib/scheduler/date.js'
import type { LocalDate } from '../lib/scheduler/date.js'
import { reservedLoadOf } from '../lib/scheduler/schedule.js'
import type { Rational, CardState } from '../lib/scheduler/types.js'
import type { DistractorPools } from '../lib/options/types.js'
import { localDateOf } from './time.js'
import { applySubmissions } from './replay.js'
import type { Submission } from './types.js'
import {
  loadSettings, loadReplaySnapshot, syncTransaction, type SqlRunner,
} from './db/adapters.js'

/** §6 屏② 反馈 + 圆点序列所需的完整字段 */
export type ReviewResult = {
  score: Rational
  newS: Rational
  /** 下一次复习的绝对日期（null = 本卡已 done） */
  nextReviewDate: LocalDate | null
  remainingReviews: number
  /** 圆点序列：剩余计划的绝对日期（升序） */
  remainingPlan: LocalDate[]
  replanned: boolean
  maintenanceAdvanced: boolean
  feedback: { correctChecked: number; wrongChecked: number; missed: number }
}

/**
 * 在线刷一张卡（§8.1，§6 屏②）：判分 → 落 review_log/card_state → 返回反馈与圆点序列。
 * 复用回放纯核（applySubmissions），单条提交即一次回放。变体重算同 /api/sync 口径：
 * 用**提交前 DB 快照**的 s 与 reviewCount（复现契约，见 replay.variantAt）。
 */
export async function reviewHandler(
  db: SqlRunner,
  userId: string,
  submission: Submission,
  opts: { serverNow: number; poolsOf: (cardId: string) => DistractorPools },
): Promise<ReviewResult> {
  const settings = await loadSettings(db, userId)
  const today = localDateOf(opts.serverNow, settings.timezone)
  const snapshot = await loadReplaySnapshot(db, userId, [submission], today)

  const R = settings.readyByDate === null ? -1 : diffDays(settings.readyByDate, today)
  const mode: 'sprint' | 'maintenance' = R < 0 ? 'maintenance' : 'sprint'
  const E = mode === 'sprint' ? Math.max(0, R - bufferOf(R)) : 0

  const allStates = [...snapshot.states.values()]
  const loadOf = (cardId: string): Map<number, number> =>
    reservedLoadOf(allStates.filter(s => s.cardId !== cardId))

  const applied = applySubmissions([submission], snapshot, {
    userId,
    today: 0,
    serverNowMs: opts.serverNow,
    timezone: settings.timezone,
    mode,
    E,
    settings: { readyByDate: settings.readyByDate, dailyCapacity: settings.dailyCapacity },
    poolsOf: opts.poolsOf,
    loadOf,
  })

  const state = applied.newStates.get(submission.cardId)
  const logRow = applied.logRows[0]
  const outcome = applied.results[0]?.outcome
  if (state === undefined || logRow === undefined || outcome === undefined) {
    throw new Error(`提交未被处理（可能是重复提交）：${submission.submissionId}`)
  }

  // 偏移域 plan → 绝对日期落盘
  const planDates = state.plan.map(o => addDays(today, o))
  const newStates: Array<{ cardId: string; state: CardState; planDates: LocalDate[] }> = [
    { cardId: submission.cardId, state, planDates },
  ]
  await syncTransaction(db, userId, applied.logRows, newStates, {
    readyByDate: settings.readyByDate, dailyCapacity: settings.dailyCapacity,
  })

  return {
    score: logRow.score,
    newS: outcome.newS,
    nextReviewDate: planDates[0] ?? null,
    remainingReviews: outcome.remainingReviews,
    remainingPlan: planDates,
    replanned: outcome.replanned,
    maintenanceAdvanced: outcome.maintenanceAdvanced,
    feedback: {
      correctChecked: logRow.correctChecked,
      wrongChecked: logRow.wrongChecked,
      missed: Math.max(0, logRow.keyPointsTotal - logRow.correctChecked),
    },
  }
}
