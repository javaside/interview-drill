import { getServerSession } from 'next-auth'
import { getDb } from '../../server/db/client.js'
import { buildDailyPayload } from '../../server/queue.js'
import { payloadDepsOf } from '../../server/deps.js'
import { authOptions } from '../../server/auth-config.js'
import { loadBlocks, loadTracks } from '../../server/db/adapters.js'
import { DrillSession } from './DrillSession.js'
import { Landing } from './Landing.js'

export const dynamic = 'force-dynamic'

/**
 * 刷题入口（server component，§6）：从 NextAuth session 取 userId（对齐 route 的鉴权口径），
 * 直接调 buildDailyPayload(payloadDepsOf(...)) 取可序列化 payload（不经 HTTP）→ 交给 client 容器。
 * RSC 边界纪律：只传可序列化的 payload，绝不传 deps（含函数与 idb 句柄，不可序列化）。
 * 登录逻辑 v2：首页匿名可见（不重定向）——未登录渲染站点介绍落地页
 * （真实库量 + 登录理由），真要刷题的登录入口页面上就有。
 */
export default async function DrillPage(): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId
  if (userId === undefined) {
    // 匿名落地页：只用 blocks/tracks 表（题量与岗位名），零用户数据查询——对齐 /map 匿名口径
    const blocks = await loadBlocks(getDb())
    const tracks = await loadTracks(getDb())
    const totals = {
      cards: blocks.reduce((n, b) => n + b.cardCount, 0),
      blocks: blocks.length,
      categories: new Set(blocks.map(b => b.category)).size,
    }
    return <Landing totals={totals} tracks={tracks.map(t => t.name)} />
  }

  const payload = await buildDailyPayload(payloadDepsOf(getDb(), userId, Date.now()))
  return <DrillSession payload={payload} />
}
