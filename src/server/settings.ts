import { buildDailyPayload } from './queue.js'
import { payloadDepsOf } from './deps.js'
import type { LocalDate } from '../lib/scheduler/date.js'
import {
  loadSettings, updateUserSettings, updateFreeBlockIds,
  clearActivePlans, pauseCardsInBlocks, resumeCardsInBlocks, type SqlRunner,
} from './db/adapters.js'

export type ServerDeps = { db: SqlRunner; serverNowMs: number }

/**
 * 设置变更入口（§5.5 条件 2/3）：readyByDate 或 dailyCapacity 变更后，**全部有计划的
 * 活跃卡**必须重排——新窗口下旧计划形状无效。实现 = 更新设置 → 清空活跃卡的计划 →
 * 跑 buildDailyPayload 装配核（清空后它们成 fresh，被重新生成落盘）。
 * 返回被重排的卡数（= 清空的活跃计划数）。
 */
export async function applySettingsChange(
  deps: ServerDeps, userId: string,
  next: { readyByDate?: LocalDate | null; dailyCapacity?: number },
): Promise<{ replanned: number }> {
  await updateUserSettings(deps.db, userId, next)
  const replanned = await clearActivePlans(deps.db, userId)
  await buildDailyPayload(payloadDepsOf(deps.db, userId, deps.serverNowMs))
  return { replanned }
}

/**
 * 块集变更入口（§5.5 条件 4）：diff 新旧块集。
 * - 减块：pauseCardsInBlocks（phase→paused，plan 保留，不进今日队列）。
 * - 加块：新块卡本无状态行，下次 buildDailyPayload 自然作为 fresh 装配；曾暂停的
 *   （加回）恢复 phase 且 plan 原样保留（plan-once → 往返幂等）。
 * 更新 freeBlockIds。返回暂停/恢复的卡数。
 */
export async function applyBlockSelection(
  deps: ServerDeps, userId: string, blockIds: readonly string[],
): Promise<{ paused: number; added: number }> {
  const settings = await loadSettings(deps.db, userId)
  const oldSet = new Set(settings.freeBlockIds)
  const newSet = new Set(blockIds)
  const removed = [...oldSet].filter(b => !newSet.has(b))
  const added = [...newSet].filter(b => !oldSet.has(b))

  const paused = await pauseCardsInBlocks(deps.db, userId, removed)
  const resumed = await resumeCardsInBlocks(deps.db, userId, added)
  await updateFreeBlockIds(deps.db, userId, [...newSet])
  return { paused, added: resumed }
}
