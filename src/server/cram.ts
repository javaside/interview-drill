/**
 * 面试临时加密入口（§5.8 · 计划 6 Task 6）。用户约到面试（提前 2-5 天）时，
 * 对选中块里 s 最低的卡在剩余窗口重铺冲刺；**其余块计划逐字节不变**。
 *
 * 消费模式（评审修正的关键洞）：cram 落盘同时把 readyByDate 置为面试前一天——
 * 这是 §5.5 条件 2「日期变更全局重排」的显式豁免（spec §5.8 v2 注记）。否则常备
 * 用户（readyByDate=null）cram 后第一次提交就走 maintenance 分支，整条阶梯被
 * [today+interval] 替换，临时加密第一刷即被销毁。面试日一过 R<0 自动回常备。
 */
import { cramForInterview, } from '../lib/scheduler/regenerate.js'
import { reservedLoadOf } from '../lib/scheduler/schedule.js'
import { prefixCheck } from '../lib/scheduler/capacity.js'
import { entitledBlockIds } from '../lib/entitlement/entitlement.js'
import { addDays, diffDays } from '../lib/scheduler/date.js'
import type { LocalDate } from '../lib/scheduler/date.js'
import { localDateOf } from './time.js'
import {
  loadSettings, entitlementOf, loadAllCards, loadAllCardStates, persistPlans,
  updateUserSettings, type SqlRunner,
} from './db/adapters.js'

export type CramDeps = { db: SqlRunner; serverNowMs: number }

export type CramResult = {
  /** 已重铺冲刺计划的卡数 */
  crammed: number
  /** 窗口不足（E<1）被排除的卡数 */
  excluded: number
  /** 新计划 + excluded 旧计划的合并负载超容（诚实告警，不阻塞——§11） */
  overloaded: boolean
}

/**
 * 临时加密（§5.8）：
 * 1. 校验块集 ⊆ 解锁块（免费墙边界不被 cram 绕过）；
 * 2. 选中块卡 + 其他卡的计划占位（reservedLoadOf——已跳过 paused 与负偏移，
 *    满足 cramForInterview 的「不含本选中块旧计划」契约）；
 * 3. cramForInterview 纯核重排（s 升序优先，二分最大可行前缀）；
 * 4. 二次 prefixCheck：excluded 卡保留旧计划且不占判据，新前缀可能与之撞天——
 *    超容则 overloaded=true（UI 提示，不静默）；
 * 5. 落盘 + readyByDate = 面试前一天（crammed>0 时；E<1 全排除则设置不动）。
 */
export async function applyCram(
  deps: CramDeps, userId: string,
  req: { examDate: LocalDate; blockIds: readonly string[] },
): Promise<CramResult> {
  const row = await loadSettings(deps.db, userId)
  const today = localDateOf(deps.serverNowMs, row.timezone)
  const { cards } = await loadAllCards(deps.db)

  // 1. 免费墙边界：cram 的块必须在解锁集内
  const ent = entitlementOf(row)
  const unlocked = new Set(entitledBlockIds(ent, [...new Set(cards.map(c => c.blockId))]))
  for (const b of req.blockIds) {
    if (!unlocked.has(b)) throw new Error(`块未解锁：${b}`)
  }
  const selectedBlocks = new Set(req.blockIds)

  // 2. 选中块卡（SchedulableCard 最小形状）+ 偏移域状态
  const selected = cards
    .filter(c => selectedBlocks.has(c.blockId))
    .map(c => ({ id: c.cardId, frequency: c.frequency }))
  const states = await loadAllCardStates(deps.db, userId, today)
  const stateMap = new Map(states.map(s => [s.cardId, s] as const))
  const reserved = reservedLoadOf(states.filter(s => !selectedBlocks.has(cards.find(c => c.cardId === s.cardId)?.blockId ?? '')))

  // 3. 纯核重排
  const { plans, excluded } = cramForInterview(
    selected, stateMap, req.examDate, today, row.dailyCapacity, reserved,
  )

  // 4. 二次检查：合并 excluded 旧计划占位后的前缀和
  const mergedLoad = new Map(reserved)
  for (const st of states) {
    if (selectedBlocks.has(cards.find(c => c.cardId === st.cardId)?.blockId ?? '')) continue
    for (const day of st.plan) {
      if (day < 0) continue
      mergedLoad.set(day, (mergedLoad.get(day) ?? 0) + 1)
    }
  }
  for (const plan of plans.values()) {
    for (const day of plan) mergedLoad.set(day, (mergedLoad.get(day) ?? 0) + 1)
  }
  const readyBy = addDays(req.examDate, -1)
  const R = diffDays(readyBy, today)
  const E = Math.max(0, R - (R < 30 ? 1 : R < 50 ? 2 : 3))
  const overloaded = prefixCheck(mergedLoad, row.dailyCapacity, E) !== undefined

  // 5. 落盘 + 就绪日（crammed>0 才动设置——E<1 全排除时保持常备空值）
  if (plans.size > 0) {
    await persistPlans(deps.db, userId, [...plans].map(([cardId, offsets]) => ({
      cardId, plan: offsets.map(o => addDays(today, o)),
    })))
    await updateUserSettings(deps.db, userId, { readyByDate: readyBy })
  }

  return { crammed: plans.size, excluded: excluded.length, overloaded }
}
