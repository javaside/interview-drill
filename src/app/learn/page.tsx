import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { getDb } from '../../server/db/client.js'
import { LearnView } from './LearnView.js'
import type { LearnCard } from './LearnView.js'
import { authOptions } from '../../server/auth-config.js'
import { loadSettings, loadAllCards, entitlementOf } from '../../server/db/adapters.js'
import { entitledCards } from '../../lib/entitlement/entitlement.js'

export const dynamic = 'force-dynamic'

/**
 * 块学习页（教材在前、习题在后）：该块的卡按题面 + 题解讲解通读，
 * 底部进入测试。免费墙：只学解锁块。
 */
export default async function LearnPage(
  { searchParams }: { searchParams: Promise<{ block?: string }> },
): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId
  if (userId === undefined) redirect('/api/auth/signin')

  const { block } = await searchParams
  if (block === undefined) redirect('/map')

  const row = await loadSettings(getDb(), userId)
  const ent = entitlementOf(row)
  const { cards } = await loadAllCards(getDb())
  const schedulable = entitledCards(
    ent, cards.map(c => ({ cardId: c.cardId, blockId: c.blockId, frequency: c.frequency })),
  )
  const ids = new Set(
    schedulable.filter(c => c.blockId === block).map(c => c.cardId),
  )
  const inBlock = cards
    .filter(c => ids.has(c.cardId))
    .map((c): LearnCard => ({
      cardId: c.cardId,
      question: c.question ?? '',
      frequency: c.frequency,
      detail: c.detail ?? '',
    }))
    .sort((a, b) => (a.cardId < b.cardId ? -1 : 1))

  const blockName = cards.find(c => c.blockId === block)?.blockName ?? block
  return <LearnView blockName={blockName} cards={inBlock} blockId={block} />
}
