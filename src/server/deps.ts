import { localDateOf } from './time.js'
import { buildDistractorPools } from './queue.js'
import type { DailyPayloadDeps } from './queue.js'
import { loadDemoCode, loadDemoSourceUrl } from './demo-code.js'
import type { BlockMapDeps } from './map.js'
import type { DistractorPools } from '../lib/options/types.js'
import { gatewayOf } from './billing-gateway.js'
import type { BillingDeps } from './billing.js'
import {
  loadSettings, entitlementOf, accessStateOfRow, selectionBlockIdsOf,
  loadAllCards, loadAllCardStates, loadBlocks,
  persistPlans, ensureDailySession, countTodayDone, countTodayMisses, type SqlRunner,
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
      const row = await loadSettings(db, userId, serverNowMs)
      return {
        settings: { readyByDate: row.readyByDate, dailyCapacity: row.dailyCapacity, timezone: row.timezone },
        ent: entitlementOf(row, serverNowMs),
        // 排期范围口径（付费/免费 = 已保存勾选；宽限期 = 勾选 ∪ 宽限块）。没有 paid
        // 兜底——空集就是空集（buildDailyPayload 只做「按勾选集过滤」，付费用户兑换后
        // 勾选被清空时首页不出题，需回设置重勾）。
        selectionBlockIds: new Set(selectionBlockIdsOf(row, serverNowMs)),
        graceActive: accessStateOfRow(row, serverNowMs) === 'grace',
      }
    },
    loadCards: () => loadAllCards(db),
    async loadStates() {
      const row = await loadSettings(db, userId, serverNowMs)
      return loadAllCardStates(db, userId, localDateOf(serverNowMs, row.timezone))
    },
    persistPlans: plans => persistPlans(db, userId, plans),
    ensureDailySession: (today, size) => ensureDailySession(db, userId, today, size),
    countTodayDone: today => countTodayDone(db, userId, today),
    countTodayMisses: today => countTodayMisses(db, userId, today),
    loadDemoCode,
    loadDemoSourceUrl,
  }
}

/**
 * buildBlockMap 的 IO 依赖装配（/api/map route 与 /map page 共用）。
 * today 由 settings 时区 + 服务器当前时刻推出（plan 偏移基准，映射内不敏感）；
 * loadCardBlocks 复用 loadAllCards（未退役卡）取每卡 blockId + frequency。
 */
export function mapDepsOf(db: SqlRunner, userId: string): BlockMapDeps {
  return {
    userId,
    loadBlocks: () => loadBlocks(db),
    async loadStates() {
      const row = await loadSettings(db, userId)
      return loadAllCardStates(db, userId, localDateOf(Date.now(), row.timezone))
    },
    async loadEnt() {
      const nowMs = Date.now()
      return entitlementOf(await loadSettings(db, userId, nowMs), nowMs)
    },
    async loadCardBlocks() {
      const { cards } = await loadAllCards(db)
      return new Map(cards.map(c => [c.cardId, { blockId: c.blockId, frequency: c.frequency }] as const))
    },
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
  const nowMs = Date.now()
  const settingsRow = await loadSettings(db, userId, nowMs)
  const ent = entitlementOf(settingsRow, nowMs)
  const { cards, categories } = await loadAllCards(db)
  const byId = new Map(cards.map(c => [c.cardId, c] as const))
  return (cardId: string): DistractorPools => {
    const card = byId.get(cardId)
    if (card === undefined) throw new Error(`卡不存在或已退役：${cardId}`)
    return buildDistractorPools(card, cards, ent, categories)
  }
}

/**
 * billing 纯核（createOrder/fulfillOrder/handleWebhook）的 IO 依赖装配：
 * 生产/集成测试共用；网关经 gatewayOf 选择（当前恒 fake，真实网关注册见 billing-gateway.ts）。
 */
export function billingDepsOf(db: SqlRunner, gatewayName = 'fake'): BillingDeps {
  return { db, gateway: gatewayOf(gatewayName) }
}
