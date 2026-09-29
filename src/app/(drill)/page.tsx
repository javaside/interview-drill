import { getServerSession } from 'next-auth'
import { getDb } from '../../server/db/client.js'
import { buildDailyPayload } from '../../server/queue.js'
import { payloadDepsOf } from '../../server/deps.js'
import { authOptions } from '../../server/auth-config.js'
import { DrillSession } from './DrillSession.js'
import { SignInPrompt } from '../SignInPrompt.js'

export const dynamic = 'force-dynamic'

/**
 * 刷题入口（server component，§6）：从 NextAuth session 取 userId（对齐 route 的鉴权口径），
 * 直接调 buildDailyPayload(payloadDepsOf(...)) 取可序列化 payload（不经 HTTP）→ 交给 client 容器。
 * RSC 边界纪律：只传可序列化的 payload，绝不传 deps（含函数与 idb 句柄，不可序列化）。
 * 登录逻辑 v2：首页匿名可见（不重定向）——真要刷题时给登录提示，不静默跳 OAuth。
 */
export default async function DrillPage(): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId
  if (userId === undefined) return <SignInPrompt what="刷题" />

  const payload = await buildDailyPayload(payloadDepsOf(getDb(), userId, Date.now()))
  return <DrillSession payload={payload} />
}
