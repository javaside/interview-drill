import { buildDailyPayload } from './queue.js'
import { buildBlockMap } from './map.js'
import { payloadDepsOf, mapDepsOf } from './deps.js'
import { localDateOf } from './time.js'
import { diffDays } from '../lib/scheduler/date.js'
import type { LocalDate } from '../lib/scheduler/date.js'
import {
  loadSettings, updateUserSettings, updateFreeBlockIds,
  clearActivePlans, pauseCardsInBlocks, resumeCardsInBlocks, reviveDoneCards,
  loadBlocks, type SqlRunner,
} from './db/adapters.js'

/** paid 用户全部块 id（done 复活范围）；free 由 freeBlockIds 决定 */
async function allBlockIds(db: SqlRunner): Promise<string[]> {
  return (await loadBlocks(db)).map(b => b.blockId)
}

export type ServerDeps = { db: SqlRunner; serverNowMs: number }

/**
 * 设置屏视图（Task 11）：预填当前就绪日/容量/计划 + 块选择态。
 * blocks 复用 buildBlockMap，`selected = entry.unlocked`（免费=已选块，付费=全部）。
 */
export type SettingsView = {
  readyByDate: LocalDate | null
  dailyCapacity: number
  plan: 'free' | 'paid'
  /** 按 DB 返回顺序的平铺块列表；category 供表单按大类分组渲染 */
  blocks: Array<{ blockId: string; blockName: string; category: string; cardCount: number; selected: boolean }>
}

/**
 * 装配设置屏视图（GET /api/settings 薄壳 + settings page 共用）：
 * loadSettings 取 readyByDate/dailyCapacity/plan；buildBlockMap 取块列表，
 * selected = unlocked（不发明新查询，复用 Task 9 的映射管线）。
 */
export async function loadSettingsView(deps: ServerDeps, userId: string): Promise<SettingsView> {
  const [row, entries] = await Promise.all([
    loadSettings(deps.db, userId),
    buildBlockMap(mapDepsOf(deps.db, userId)),
  ])
  return {
    readyByDate: row.readyByDate,
    dailyCapacity: row.dailyCapacity,
    plan: row.plan,
    blocks: entries.map(e => ({
      blockId: e.blockId,
      blockName: e.blockName,
      category: e.category,
      cardCount: e.cardCount,
      selected: e.unlocked,
    })),
  }
}

/**
 * 设置变更入口（§5.5 条件 2/3）：readyByDate 或 dailyCapacity 变更后，**全部有计划的
 * 活跃卡**必须重排——新窗口下旧计划形状无效。实现 = 更新设置 → 清空活跃卡的计划 →
 * 跑 buildDailyPayload 装配核（清空后它们成 fresh，被重新生成落盘）。
 * 返回被重排的卡数（= 清空的活跃计划数）。
 *
 * **常备模式豁免（R-1）**：结果模式为 maintenance（就绪日为空或已过期）时不清空——
 * 维持分支不生成任何计划，清空后无人再种，滚动计划会被永久黑洞（用户实测：常备下
 * 改容量丢全部复习排期）。滚动间隔不依赖窗口形状，容量变更对它无意义，直接跳过。
 */
export async function applySettingsChange(
  deps: ServerDeps, userId: string,
  next: { readyByDate?: LocalDate | null; dailyCapacity?: number },
): Promise<{ replanned: number }> {
  await updateUserSettings(deps.db, userId, next)
  const row = await loadSettings(deps.db, userId)
  const today = localDateOf(deps.serverNowMs, row.timezone)
  // 存量 done 复活（v2 迁移）：v1 自动毕业的卡救回排期（两条模式路径都要；
  // 常备路径 reviveDoneCards 内部补种滚动计划，sprint 路径由随后的重排接管）
  await reviveDoneCards(deps.db, userId,
    row.plan === 'paid' ? await allBlockIds(deps.db) : row.freeBlockIds, today)
  if (row.readyByDate === null || diffDays(row.readyByDate, today) < 0) {
    return { replanned: 0 }   // 常备模式：滚动计划原样保留
  }
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
