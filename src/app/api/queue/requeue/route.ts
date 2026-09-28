import { NextResponse } from 'next/server'
import { getDb } from '../../../../server/db/client.js'
import { requeueTodaysMissedCards, loadSettings } from '../../../../server/db/adapters.js'
import { requireUserId } from '../../../../server/auth-config.js'
import { localDateOf } from '../../../../server/time.js'

export const dynamic = 'force-dynamic'

/**
 * 再练错题端点（v2 薄壳）。鉴权经 requireUserId。
 * 把「今天答错过、下次复习排在今天之后」的卡拉回今天（用户主动触发，
 * 非自动回队）——初学阶段的密集重练权还给用户。返回拉回的卡数。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  const row = await loadSettings(getDb(), userId)
  const today = localDateOf(Date.now(), row.timezone)
  const requeued = await requeueTodaysMissedCards(getDb(), userId, today)
  return NextResponse.json({ requeued })
}
