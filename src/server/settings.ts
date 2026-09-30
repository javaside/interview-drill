import { buildDailyPayload } from './queue.js'
import { buildBlockMap } from './map.js'
import { payloadDepsOf, mapDepsOf } from './deps.js'
import { localDateOf } from './time.js'
import { diffDays } from '../lib/scheduler/date.js'
import type { LocalDate } from '../lib/scheduler/date.js'
import {
  loadSettings, loadTracks, updateUserSettings, updateFreeBlockIds,
  clearActivePlans, pauseCardsInBlocks, resumeCardsInBlocks, reviveDoneCards,
  loadBlocks, type SqlRunner, type TrackRow,
} from './db/adapters.js'
import { FREE_BLOCK_LIMIT } from '../lib/entitlement/entitlement.js'

export type ServerDeps = { db: SqlRunner; serverNowMs: number }

/**
 * 设置屏视图（Task 11）：预填当前就绪日/容量/计划 + 块选择态。
 * blocks 复用 buildBlockMap；`selected` = 已保存勾选集（free_block_ids，空即空），
 * 与排期同一口径、所见即所得——不能用 entry.unlocked（entitlement 口径，与勾选
 * 无关）：付费用户手动收窄勾选后保存，回读若按 unlocked 显示会永远「默认全选」，
 * 勾选等于白勾。unlocked（解锁边界）与 selected（排期范围）分家：前者归地图/自由刷。
 */
export type SettingsView = {
  readyByDate: LocalDate | null
  dailyCapacity: number
  plan: 'free' | 'paid'
  /** 当前岗位包；null = 全部。纯导航偏好（不进 entitlement）；设置页无岗位设置项，
   *岗位在此页的唯一用途 = 「按岗位快速勾选」动作的素材（非持久化状态） */
  trackId: string | null
  /** 岗位包列表（id/name + 块引用集），供块区「按岗位快速勾选」按钮 */
  tracks: Array<Pick<TrackRow, 'id' | 'name' | 'blockIds'>>
  /** 按大类分组的块列表；category 供表单分组渲染，selected = 已保存勾选（排期范围） */
  blocks: Array<{ blockId: string; blockName: string; category: string; cardCount: number; selected: boolean }>
}

/**
 * 装配设置屏视图（GET /api/settings 薄壳 + settings page 共用）：
 * loadSettings 取 readyByDate/dailyCapacity/plan/trackId + 勾选集；buildBlockMap 取块列表
 * （真实题数）。selected 由勾选集判定（见类型注释）；trackId 悬空（track 已下线）时
 * 归一化为 null——UI 不必处理幽灵值。
 */
export async function loadSettingsView(deps: ServerDeps, userId: string): Promise<SettingsView> {
  const [row, entries, tracks] = await Promise.all([
    loadSettings(deps.db, userId),
    buildBlockMap(mapDepsOf(deps.db, userId)),
    loadTracks(deps.db),
  ])
  const trackIds = new Set(tracks.map(t => t.id))
  // 回放与排期同一口径：勾选集本身，空即空——所见即所得，无隐藏兜底
  const selectedIds = new Set(row.freeBlockIds)
  return {
    readyByDate: row.readyByDate,
    dailyCapacity: row.dailyCapacity,
    plan: row.plan,
    trackId: row.trackId !== null && trackIds.has(row.trackId) ? row.trackId : null,
    tracks: tracks.map(t => ({ id: t.id, name: t.name, blockIds: t.blockIds })),
    blocks: entries.map(e => ({
      blockId: e.blockId,
      blockName: e.blockName,
      category: e.category,
      cardCount: e.cardCount,
      selected: selectedIds.has(e.blockId),
    })),
  }
}

/**
 * 设置变更入口（§5.5 条件 2/3）：readyByDate 或 dailyCapacity **实际变更**后，
 * 全部有计划的活跃卡必须重排——新窗口下旧计划形状无效。实现 = 更新设置 → 清空
 * 活跃卡的计划 → 跑 buildDailyPayload 装配核（清空后它们成 fresh，被重新生成落盘）。
 * 返回被重排的卡数与是否有实际变更（无变化时跳过重排——保护 cram 布局，且
 * 消除「保存但啥都没改」触发的不必要全局重排）。
 *
 * **常备模式豁免（R-1）**：结果模式为 maintenance（就绪日为空或已过期）时不清空——
 * 维持分支不生成任何计划，清空后无人再种，滚动计划会被永久黑洞（用户实测：常备下
 * 改容量丢全部复习排期）。滚动间隔不依赖窗口形状，容量变更对它无意义，直接跳过。
 *
 * **容量校验**：非 ≥1 整数直接拒绝（此前 0 可入库并把重排打进死循环）。
 */
export async function applySettingsChange(
  deps: ServerDeps, userId: string,
  next: { readyByDate?: LocalDate | null; dailyCapacity?: number; trackId?: string | null },
): Promise<{ replanned: number; changed: boolean }> {
  if (next.dailyCapacity !== undefined
    && (!Number.isInteger(next.dailyCapacity) || next.dailyCapacity < 1)) {
    throw new Error(`每日容量须为 ≥1 的整数，收到 ${next.dailyCapacity}`)
  }
  const before = await loadSettings(deps.db, userId)
  await updateUserSettings(deps.db, userId, next)
  // trackId 是纯导航偏好：单独变更不触发重排（改岗位视图不该把排期打乱）
  const touchesPlan = 'readyByDate' in next || next.dailyCapacity !== undefined
  const dateChanged = 'readyByDate' in next && (next.readyByDate ?? null) !== before.readyByDate
  const capChanged = next.dailyCapacity !== undefined && next.dailyCapacity !== before.dailyCapacity
  if (!touchesPlan || (!dateChanged && !capChanged)) return { replanned: 0, changed: false }

  const row = await loadSettings(deps.db, userId)
  const today = localDateOf(deps.serverNowMs, row.timezone)
  // 存量 done 复活（v2 迁移）：v1 自动毕业的卡救回排期（两条模式路径都要；
  // 常备路径 reviveDoneCards 内部补种滚动计划，sprint 路径由随后的重排接管）。
  // 复活范围 = 排期范围同一口径（勾选集）——排期不认的块复活了也没人消费
  await reviveDoneCards(deps.db, userId, row.freeBlockIds, today)
  if (row.readyByDate === null || diffDays(row.readyByDate, today) < 0) {
    return { replanned: 0, changed: true }   // 常备模式：滚动计划原样保留
  }
  const replanned = await clearActivePlans(deps.db, userId)
  await buildDailyPayload(payloadDepsOf(deps.db, userId, deps.serverNowMs))
  return { replanned, changed: true }
}

/**
 * 块集变更入口（§5.5 条件 4）：diff 新旧块集。勾选集 = 排期范围（两档同语义：
 * 免费另兼免费墙边界；付费 = 纯排期范围，自由刷/语料不受限）。
 * - 减块：pauseCardsInBlocks（phase→paused，plan 保留，不进今日队列）。
 * - 加块：新块卡本无状态行，下次 buildDailyPayload 自然作为 fresh 装配；曾暂停的
 *   （加回）恢复 phase 且 plan 原样保留（plan-once → 往返幂等）。
 * 更新 freeBlockIds（对付费同样落库——设置页回放勾选态、排期范围都读它）。
 *
 * **服务端免费墙（此前仅 UI 拦截，API 直调可写坏 free_block_ids，令 entitlementOf
 * 在别处抛异常拖垮地图/cram 页）**：块 id 必须真实存在；free 用户去重后 ≤
 * FREE_BLOCK_LIMIT。校验在一切写操作之前——拒绝即无副作用。
 */
export async function applyBlockSelection(
  deps: ServerDeps, userId: string, blockIds: readonly string[],
): Promise<{ paused: number; added: number }> {
  const settings = await loadSettings(deps.db, userId)
  const unique = [...new Set(blockIds)]

  const known = new Set((await loadBlocks(deps.db)).map(b => b.blockId))
  for (const id of unique) {
    if (!known.has(id)) throw new Error(`块 id 不存在：${id}`)
  }
  if (settings.plan === 'free' && unique.length > FREE_BLOCK_LIMIT) {
    throw new Error(`免费层最多 ${FREE_BLOCK_LIMIT} 个块，收到 ${unique.length} 个（§10.1）`)
  }

  const oldSet = new Set(settings.freeBlockIds)
  const newSet = new Set(unique)
  const removed = [...oldSet].filter(b => !newSet.has(b))
  const added = [...newSet].filter(b => !oldSet.has(b))

  const paused = await pauseCardsInBlocks(deps.db, userId, removed)
  const resumed = await resumeCardsInBlocks(deps.db, userId, added)
  await updateFreeBlockIds(deps.db, userId, [...newSet])
  return { paused, added: resumed }
}
