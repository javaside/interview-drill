import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { getDb } from '../../server/db/client.js'
import { buildBlockMap, filterEntriesByTrack } from '../../server/map.js'
import { mapDepsOf } from '../../server/deps.js'
import { authOptions } from '../../server/auth-config.js'
import { loadSettings, loadTracks } from '../../server/db/adapters.js'
import { KnowledgeMap } from './KnowledgeMap.js'

export const dynamic = 'force-dynamic'

/**
 * 知识地图入口（server component，§4.4/§10.1）：从 NextAuth session 取 userId（对齐 route 口径），
 * 直接调 buildBlockMap(mapDepsOf(...)) 取可序列化 entries（不经 HTTP）→ 交给纯展示组件。
 * 岗位包（?track=）是导航视图：显式参数优先于用户设置里的默认岗位；未知 id 回退全部。
 */
export default async function MapPage(
  { searchParams }: { searchParams: Promise<{ track?: string }> },
): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId
  if (userId === undefined) redirect('/api/auth/signin')

  const { track: trackParam } = await searchParams
  const [entries, tracks, settings] = await Promise.all([
    buildBlockMap(mapDepsOf(getDb(), userId)),
    loadTracks(getDb()),
    loadSettings(getDb(), userId),
  ])
  const trackId = trackParam !== undefined && tracks.some(t => t.id === trackParam)
    ? trackParam
    : tracks.some(t => t.id === settings.trackId) ? settings.trackId : null
  const filtered = filterEntriesByTrack(entries, tracks, trackId)
  // 刊头统计：真实库量（非演示数字）
  const totals = {
    cards: entries.reduce((n, e) => n + e.cardCount, 0),
    blocks: entries.length,
    tracks: tracks.length,
  }
  return (
    <KnowledgeMap
      entries={filtered}
      tracks={tracks.map(t => ({ id: t.id, name: t.name }))}
      activeTrackId={trackId}
      totals={totals}
    />
  )
}
