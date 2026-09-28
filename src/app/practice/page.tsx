import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { getDb } from '../../server/db/client.js'
import { practiceQueue } from '../../server/queue.js'
import { payloadDepsOf } from '../../server/deps.js'
import { authOptions } from '../../server/auth-config.js'
import { DrillSession } from '../(drill)/DrillSession.js'

export const dynamic = 'force-dynamic'

/**
 * 自由刷题入口（v2 用户主权）：按块练习——**不看排期**，想刷就刷。
 * 复用 DrillSession 主循环（判分/反馈/离线全同构）；练习不占今日分母，
 * 每次作答照常计分并按表现进退档——算法是参谋不是门卫。
 */
export default async function PracticePage(
  { searchParams }: { searchParams: Promise<{ block?: string }> },
): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId
  if (userId === undefined) redirect('/api/auth/signin')

  const { block } = await searchParams
  if (block === undefined) redirect('/map')

  const payload = await practiceQueue(
    payloadDepsOf(getDb(), userId, Date.now()), userId, block,
  )
  return <DrillSession payload={payload} />
}
