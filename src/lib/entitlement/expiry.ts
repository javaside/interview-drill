/**
 * 通行证到期判定与结算（纯核，零 IO）。今日由调用方注入——本文件不读时钟。
 *
 * 为什么需要「结算」而不是每次实时算：宽限的承诺是「排到哪天就给你刷到哪天」。
 * 实时算会让宽限终点随排期被消费而不断前移（计划耗尽的卡退出 plan，max(plan)
 * 随之变小），承诺当场缩水。所以在到期后的第一次读取把 grace_until /
 * grace_block_ids 冻结落库（写入由 server 层执行），此后只读不再变。
 *
 * 终止保证：维持模式没有天然终点——schedule() 的 maintenance 分支不生成计划，
 * todayQueue 按到期状态滚动算，会一直滚下去。字面执行「让排期跑完」等价于永久
 * 免费，故必须补 GRACE_MAINTENANCE_DAYS 封顶（用户 2026-10-02 拍板）。
 */
import { addDays, diffDays } from '../scheduler/date.js'
import type { LocalDate } from '../scheduler/date.js'
import { FREE_BLOCK_LIMIT, GRACE_MAINTENANCE_DAYS } from './entitlement.js'

export type AccessState = 'paid' | 'grace' | 'free'

type AccessArgs = {
  /** null = 从未付费 */
  paidUntilMs: number | null
  /** null = 未结算（未到期或从未付费） */
  graceUntil: LocalDate | null
  nowMs: number
  today: LocalDate
}

/**
 * 档位判定：有效期内 paid；宽限期内 grace；否则 free。
 * 这是 UI 与配额的唯一入口——**绝不直接读遗留的 plan 列**。
 */
export function accessStateOf(a: AccessArgs): AccessState {
  if (a.paidUntilMs !== null && a.paidUntilMs > a.nowMs) return 'paid'
  if (a.graceUntil !== null && diffDays(a.graceUntil, a.today) >= 0) return 'grace'
  return 'free'
}

export type ExpiryAction =
  | { kind: 'none' }
  /** 首次结算：冻结宽限块 + 勾选收敛到 ≤2 */
  | { kind: 'settle'; graceUntil: LocalDate; graceBlockIds: string[]; freeBlockIds: string[] }
  /** 宽限已结束：只把勾选收敛回 ≤2（宽限期内可任意多选） */
  | { kind: 'clamp'; freeBlockIds: string[] }

/**
 * 结算决策。`scheduled` 由调用方按内容顺序喂入（保证「宽限块前 2 个进免费层」
 * 确定、可测）——调用方只需在真正要算时才查库。
 *
 * 到期瞬间把勾选收敛到 ≤2 是**必须的**：付费用户的勾选集（借存在 free_block_ids
 * 列）通常几十个块，直接当免费层用会触发 makeFreeEntitlement 的 ≤2 抛错，
 * 令首页/地图/学习页全 500——比「掉到 0 块」更糟。
 */
export function expiryAction(a: AccessArgs & {
  readyByDate: LocalDate | null
  /** 当前勾选集（free_block_ids 原样，内容顺序） */
  selection: readonly string[]
  /** 仍有未完成排期的块与该块最晚排期日，按 blockId 升序 */
  scheduled: ReadonlyArray<{ blockId: string; lastPlannedDate: LocalDate }>
}): ExpiryAction {
  if (a.paidUntilMs === null) return { kind: 'none' }
  if (a.paidUntilMs > a.nowMs) return { kind: 'none' }

  if (a.graceUntil === null) {
    const graceBlockIds = [...new Set(a.scheduled.map(s => s.blockId))]
    // 就绪日已过（R<0）等于维持模式：那种情形下的「跑完」没有终点，走 14 天封顶
    const sprint = a.readyByDate !== null && diffDays(a.readyByDate, a.today) >= 0
    let graceUntil: LocalDate
    if (sprint) {
      let last: LocalDate = a.readyByDate!
      for (const s of a.scheduled) {
        if (diffDays(s.lastPlannedDate, last) > 0) last = s.lastPlannedDate
      }
      graceUntil = last
    } else {
      graceUntil = addDays(a.today, GRACE_MAINTENANCE_DAYS)
    }
    // 宽限块优先，再用原勾选补齐——从未勾选过的付费用户（勾选为空）也不至于掉到 0 块
    const freeBlockIds = [...new Set([...graceBlockIds, ...a.selection])].slice(0, FREE_BLOCK_LIMIT)
    return { kind: 'settle', graceUntil, graceBlockIds, freeBlockIds }
  }

  if (diffDays(a.graceUntil, a.today) >= 0) return { kind: 'none' }
  const unique = [...new Set(a.selection)]
  if (unique.length <= FREE_BLOCK_LIMIT) return { kind: 'none' }
  return { kind: 'clamp', freeBlockIds: unique.slice(0, FREE_BLOCK_LIMIT) }
}
