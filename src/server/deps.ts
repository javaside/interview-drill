import { localDateOf } from './time.js'
import { buildDistractorPools } from './queue.js'
import type { DailyPayloadDeps } from './queue.js'
import type { DistractorPools } from '../lib/options/types.js'
import {
  loadSettings, entitlementOf, loadAllCards, loadAllCardStates,
  persistPlans, ensureDailySession, countTodayDone, type SqlRunner,
} from './db/adapters.js'

/**
 * buildDailyPayload 的 IO 依赖装配（HTTP route 与设置/块集入口共用，避免重复接线）。
 * 全部经 adapters，纯核 buildDailyPayload 只认这个接口。
 */
export function payloadDepsOf(db: SqlRunner, userId: string, serverNowMs: number): DailyPayloadDeps {
  return {
    userId,
    serverNowMs,
    async loadSettings() {
      const row = await loadSettings(db, userId)
      return {
        settings: { readyByDate: row.readyByDate, dailyCapacity: row.dailyCapacity, timezone: row.timezone },
        ent: entitlementOf(row),
      }
    },
    loadCards: () => loadAllCards(db),
    async loadStates() {
      const row = await loadSettings(db, userId)
      return loadAllCardStates(db, userId, localDateOf(serverNowMs, row.timezone))
    },
    persistPlans: plans => persistPlans(db, userId, plans),
    ensureDailySession: (today, size) => ensureDailySession(db, userId, today, size),
    countTodayDone: today => countTodayDone(db, userId, today),
  }
}

/**
 * HTTP 路径（/api/sync、/api/review）的 poolsOf 装配：一次载全库卡 + 大类 + entitlement，
 * 返回 cardId → DistractorPools 的闭包。全程走唯一入口 buildDistractorPools（终审裁决）。
 * 集成测试直接给 syncHandler/reviewHandler 传简池，绕过此装配与 HTTP。
 */
export async function poolsOfFor(
  db: SqlRunner, userId: string,
): Promise<(cardId: string) => DistractorPools> {
  const settingsRow = await loadSettings(db, userId)
  const ent = entitlementOf(settingsRow)
  const { cards, categories } = await loadAllCards(db)
  const byId = new Map(cards.map(c => [c.cardId, c] as const))
  return (cardId: string): DistractorPools => {
    const card = byId.get(cardId)
    if (card === undefined) throw new Error(`卡不存在或已退役：${cardId}`)
    return buildDistractorPools(card, cards, ent, categories)
  }
}
