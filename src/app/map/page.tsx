import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { getDb } from '../../server/db/client.js'
import { buildBlockMap } from '../../server/map.js'
import { mapDepsOf } from '../../server/deps.js'
import { authOptions } from '../../server/auth-config.js'
import { KnowledgeMap } from './KnowledgeMap.js'

export const dynamic = 'force-dynamic'

/**
 * 知识地图入口（server component，§4.4/§10.1）：从 NextAuth session 取 userId（对齐 route 口径），
 * 直接调 buildBlockMap(mapDepsOf(...)) 取可序列化 entries（不经 HTTP）→ 交给纯展示组件。
 */
export default async function MapPage(): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId
  if (userId === undefined) redirect('/api/auth/signin')

  const entries = await buildBlockMap(mapDepsOf(getDb(), userId))
  return <KnowledgeMap entries={entries} />
}
