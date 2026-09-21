import { bufferOf } from '../lib/scheduler/plan.js'
import { diffDays, addDays } from '../lib/scheduler/date.js'
import type { LocalDate } from '../lib/scheduler/date.js'
import { reservedLoadOf } from '../lib/scheduler/schedule.js'
import type { CardState } from '../lib/scheduler/types.js'
import type { DistractorPools } from '../lib/options/types.js'
import { localDateOf } from './time.js'
import { applySubmissions } from './replay.js'
import type { ReviewOutcome } from './replay.js'
import type { Submission } from './types.js'
import {
  loadSettings, loadReplaySnapshot, syncTransaction, type SqlRunner,
} from './db/adapters.js'

export type SyncResult = {
  results: Array<{ submissionId: string; outcome: ReviewOutcome }>
  duplicated: string[]
}

/**
 * 同步回放服务端流程（§8.3，纯核 applySubmissions 之上的 IO 编排）：
 * 载快照 → today/mode/E 判定 → 回放 → 事务落库。
 * 变体池经 poolsOf 注入（唯一装配入口 buildDistractorPools 在 Task 7/8 接入；
 * 测试直接传简池，绕过 HTTP）。
 */
export async function syncHandler(
  db: SqlRunner,
  userId: string,
  subs: Submission[],
  opts: { serverNow: number; poolsOf: (cardId: string) => DistractorPools },
): Promise<SyncResult> {
  const settings = await loadSettings(db, userId)
  const today = localDateOf(opts.serverNow, settings.timezone)
  const snapshot = await loadReplaySnapshot(db, userId, subs, today)

  // 模式与末端窗口 E（§5.7/§5.2）：readyByDate 空或已过 → 维持模式
  const R = settings.readyByDate === null ? -1 : diffDays(settings.readyByDate, today)
  const mode: 'sprint' | 'maintenance' = R < 0 ? 'maintenance' : 'sprint'
  const E = mode === 'sprint' ? Math.max(0, R - bufferOf(R)) : 0

  // 其他卡的占用图（不含本卡）：answer 重排 regenerateAfterFailure 需要
  const allStates = [...snapshot.states.values()]
  const loadOf = (cardId: string): Map<number, number> =>
    reservedLoadOf(allStates.filter(s => s.cardId !== cardId))

  const applied = applySubmissions(subs, snapshot, {
    userId,
    today: 0,   // 偏移域：today 恒为 0（snapshot.states 的 plan 已相对 today）
    serverNowMs: opts.serverNow,
    timezone: settings.timezone,
    mode,
    E,
    settings: { readyByDate: settings.readyByDate, dailyCapacity: settings.dailyCapacity },
    poolsOf: opts.poolsOf,
    loadOf,
  })

  // 偏移域 plan → 绝对日期落盘
  const newStates: Array<{ cardId: string; state: CardState; planDates: LocalDate[] }> = []
  for (const [cardId, state] of applied.newStates) {
    newStates.push({ cardId, state, planDates: state.plan.map(o => addDays(today, o)) })
  }

  await syncTransaction(db, userId, applied.logRows, newStates, {
    readyByDate: settings.readyByDate, dailyCapacity: settings.dailyCapacity,
  })

  return { results: applied.results, duplicated: applied.duplicated }
}
