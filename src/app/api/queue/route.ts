import { NextResponse } from 'next/server'
import { getDb } from '../../../server/db/client.js'
import {
  loadSettings, entitlementOf, loadAllCards, loadAllCardStates,
  persistPlans, ensureDailySession, countTodayDone,
} from '../../../server/db/adapters.js'
import { buildDailyPayload } from '../../../server/queue.js'
import { localDateOf } from '../../../server/time.js'

export const dynamic = 'force-dynamic'

/**
 * 今日队列端点（薄壳，§6/§4.3）。鉴权用开发期 x-user-id 头（Task 11 的 requireUserId
 * 接线后替换）。全部 IO 经 adapters 注入 buildDailyPayload（集成测试直接调纯核）。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const db = getDb()
  const serverNowMs = Date.now()
  const payload = await buildDailyPayload({
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
    loadStates: async () => {
      const row = await loadSettings(db, userId)
      return loadAllCardStates(db, userId, localDateOf(serverNowMs, row.timezone))
    },
    persistPlans: plans => persistPlans(db, userId, plans),
    ensureDailySession: (today, size) => ensureDailySession(db, userId, today, size),
    countTodayDone: today => countTodayDone(db, userId, today),
  })
  return NextResponse.json(payload)
}
