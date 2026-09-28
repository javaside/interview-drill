import { NextResponse } from 'next/server'
import { getDb } from '../../../../server/db/client.js'
import { requeueTodaysMissedCards, requeueTodaysCards, loadSettings } from '../../../../server/db/adapters.js'
import { requireUserId } from '../../../../server/auth-config.js'
import { localDateOf } from '../../../../server/time.js'

export const dynamic = 'force-dynamic'

/**
 * 再刷端点（v2 薄壳）。鉴权经 requireUserId。body.scope：
 * - 'misses'（默认）：把今天答错过的卡拉回今天（再练错题）
 * - 'all'：把今天刷过的卡**全部**拉回今天（全部再来一遍——含答对的，
 *   刷过一次 ≠ 记住，重复的权力在用户）。用户主动触发，非自动回队。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request)
  if (userId instanceof Response) return userId

  let scope: 'misses' | 'all' = 'misses'
  try {
    const body = (await request.json()) as { scope?: 'misses' | 'all' }
    if (body.scope === 'all') scope = 'all'
  } catch {
    // 无 body 黀认 misses
  }

  const row = await loadSettings(getDb(), userId)
  const today = localDateOf(Date.now(), row.timezone)
  const requeued = scope === 'all'
    ? await requeueTodaysCards(getDb(), userId, today)
    : await requeueTodaysMissedCards(getDb(), userId, today)
  return NextResponse.json({ requeued })
}
