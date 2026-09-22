import { localDateOf } from './time.js'
import type { DailyPayloadDeps } from './queue.js'
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
