import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDb } from '../../../server/db/client.js'
import { loadPublicCard } from '../../../server/db/adapters.js'
import { PublicQuestionView } from './PublicQuestionView.js'

export const dynamic = 'force-dynamic'

/**
 * 公开题目页 `q/[cardId]`（§7 SEO，**不做 cloaking**）。
 * 爬虫与用户走同一条渲染路径：无 headers()/UA 判断、无 'use client' 补数据、无付费墙分支。
 * 只渲染 loadPublicCard 返回的 public 要点（非 public 要点已在查询层切断，永不出现在此页）。
 * 转化入口仅一处链到 App（`/`），不写付费墙话术。
 * Next 15：params 为 Promise，需 await。
 */
export async function generateMetadata(
  { params }: { params: Promise<{ cardId: string }> },
): Promise<Metadata> {
  const { cardId } = await params
  const card = await loadPublicCard(getDb(), cardId)
  if (card === null) return { title: '题目不存在' }
  // description = public 要点前 1-2 条拼接（只用 public 文本，不含私有要点）
  const desc = card.publicKeyPoints.slice(0, 2).map(k => k.text).join('；')
  return { title: card.question, description: desc }
}

export default async function Page(
  { params }: { params: Promise<{ cardId: string }> },
): Promise<React.JSX.Element> {
  const { cardId } = await params
  const card = await loadPublicCard(getDb(), cardId)
  if (card === null) notFound()
  return <PublicQuestionView card={card} />
}
