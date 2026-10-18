import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { getDb } from '../../server/db/client.js'
import { LearnView, syllabusOf } from './LearnView.js'
import type { LearnCard } from './LearnView.js'
import { authOptions } from '../../server/auth-config.js'
import { isAdminUser } from '../../server/admin.js'
import { openReportCountsByCard } from '../../server/card-report.js'
import { loadSettings, loadAllCards, entitlementOf } from '../../server/db/adapters.js'
import { loadDemoCode, loadDemoSourceUrl } from '../../server/demo-code.js'
import { entitledCards, isEntitled } from '../../lib/entitlement/entitlement.js'
import { SignInPrompt } from '../SignInPrompt.js'

export const dynamic = 'force-dynamic'

/**
 * 块学习页（教材在前、习题在后）：该块的卡按题面 + 题解讲解通读，
 * 底部进入测试。免费墙：只学解锁块——未解锁块给解锁引导（升级/改选免费块），
 * 题面与题解绝不下发（§10.1）。
 * 登录逻辑 v2：未登录给登录提示（不静默跳 OAuth）；缺块参数仍回知识库。
 */
export default async function LearnPage(
  { searchParams }: { searchParams: Promise<{ block?: string }> },
): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId

  const { block } = await searchParams
  if (block === undefined) redirect('/map')
  if (userId === undefined) return <SignInPrompt what="学习" />

  const nowMs = Date.now()
  const row = await loadSettings(getDb(), userId, nowMs)
  const ent = entitlementOf(row, nowMs)
  const { cards } = await loadAllCards(getDb())
  const inBlockCards = cards.filter(c => c.blockId === block)
  if (inBlockCards.length === 0) redirect('/map')   // 不存在的块：回地图

  const blockName = inBlockCards[0]?.blockName ?? block

  // 管理员判定放在免费墙之前——审题是运维动作，不该取决于付费状态：
  // 管理员直读全部块（与 /api/admin/qa 无墙口径一致），并带未处理报告计数
  // （一次 group by，量小；非管理员零额外查询）。
  const admin = userId !== undefined
    && await isAdminUser({ db: getDb(), adminGithubIds: process.env.ADMIN_GITHUB_IDS ?? '' }, userId)

  if (!admin && !isEntitled(ent, block)) {
    return <LearnView blockName={blockName} cards={[]} blockId={block} locked cardCount={inBlockCards.length} />
  }

  const schedulable = admin
    ? cards.map(c => ({ cardId: c.cardId, blockId: c.blockId, frequency: c.frequency }))
    : entitledCards(ent, cards.map(c => ({ cardId: c.cardId, blockId: c.blockId, frequency: c.frequency })))
  const ids = new Set(
    schedulable.filter(c => c.blockId === block).map(c => c.cardId),
  )
  const inBlock = cards
    .filter(c => ids.has(c.cardId))
    .map((c): LearnCard => {
      const demo = loadDemoCode(c.blockId, c.cardId)
      const sourceUrl = loadDemoSourceUrl(c.cardId)
      return {
        cardId: c.cardId,
        question: c.question ?? '',
        frequency: c.frequency,
        detail: c.detail ?? '',
        keyPoints: syllabusOf(c.keyPoints),
        ...(demo === null ? {} : { demoCode: demo }),
        ...(sourceUrl === null ? {} : { demoSourceUrl: sourceUrl }),
      }
    })
    .sort((a, b) => (a.cardId < b.cardId ? -1 : 1))

  const reportsByCard = admin ? Object.fromEntries(await openReportCountsByCard({ db: getDb() })) : undefined
  return <LearnView blockName={blockName} cards={inBlock} blockId={block} admin={admin} reportsByCard={reportsByCard} />
}
