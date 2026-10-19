import { NextResponse } from 'next/server'
import { getDb } from '../../../../server/db/client.js'
import { loadCardSnapshots } from '../../../../server/db/adapters.js'
import { requireAdminUserId } from '../../../../server/admin.js'
import { errorResponse } from '../../../../server/api-error.js'
import { createCardReport, listCardReports } from '../../../../server/card-report.js'
import {
  sanitizeReportTurns, sanitizeReportConclusion, reportSnapshotOf,
} from '../../../../lib/ai/admin-qa.js'

export const dynamic = 'force-dynamic'

/**
 * 题卡问题报告（管理员审题闭环的提交口）。管理员鉴权 fail-closed。
 * - POST { cardId, conclusion, turns }：清洗 → 校验卡存在 → 连题面快照落库 → { id }。
 * - GET：台账列表（backstage「题库报告」小节）——不带 transcript（长），快照只取
 *   blockName/question 两个字段够认卡。
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireAdminUserId(request)
  if (userId instanceof Response) return userId

  try {
    const body = (await request.json().catch(() => null)) as
      { cardId?: unknown; conclusion?: unknown; turns?: unknown } | null
    if (body === null || typeof body.cardId !== 'string' || body.cardId === '') {
      return Response.json({ error: '缺少题目参数' }, { status: 400 })
    }

    const turns = sanitizeReportTurns(body.turns)
    if (turns.length === 0) throw new Error('还没有可提交的讨论——先和 AI 聊，聊出结论再提交')

    const conclusion = sanitizeReportConclusion(body.conclusion)
    if (conclusion === '') throw new Error('写一句结论再提交——台账和导出文件靠它定位问题')

    const card = (await loadCardSnapshots(getDb(), [body.cardId])).get(body.cardId)
    if (card === undefined) throw new Error('题目不存在或已下线')

    const snapshot = reportSnapshotOf({
      cardId: card.cardId,
      blockId: card.blockId,
      question: card.question ?? '',
      detail: card.detail ?? '',
      cardType: card.cardType,
      keyPoints: card.keyPoints,
      misconceptions: card.misconceptions,   // 活/退役透传，快照侧剔退役（与 keyPoints 同装配口径）
      ...(card.blockName ? { blockName: card.blockName } : {}),
    })

    const id = await createCardReport({ db: getDb() }, { cardId: card.cardId, conclusion, turns, snapshot })
    return NextResponse.json({ id })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function GET(request: Request): Promise<Response> {
  const userId = await requireAdminUserId(request)
  if (userId instanceof Response) return userId
  const rows = await listCardReports({ db: getDb() })
  return NextResponse.json(rows.map(r => ({
    id: r.id,
    cardId: r.cardId,
    status: r.status,
    conclusion: r.conclusion,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
    blockName: r.snapshot.blockName,
    question: r.snapshot.question,
  })))
}
