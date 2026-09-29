import { getServerSession } from 'next-auth'
import { getDb } from '../../server/db/client.js'
import { buildBlockMap, filterEntriesByTrack } from '../../server/map.js'
import type { BlockMapEntry } from '../../server/map.js'
import { mapDepsOf } from '../../server/deps.js'
import { authOptions } from '../../server/auth-config.js'
import { loadSettings, loadTracks, loadBlocks } from '../../server/db/adapters.js'
import { KnowledgeMap } from './KnowledgeMap.js'

export const dynamic = 'force-dynamic'

/**
 * 知识地图入口（server component，§4.4/§10.1）：直接调 buildBlockMap(mapDepsOf(...))
 * 取可序列化 entries（不经 HTTP）→ 交给纯展示组件。
 * 登录逻辑 v2：知识库匿名可见——未登录渲染真实目录（块名/题量/岗位过滤），
 * 无掌握度与解锁墙（`authed=false`）；刷题动作发生时才提示登录。
 * 已登录：完整视图（掌握度 + 免费/付费解锁位）。
 * 岗位包（?track=）是导航视图：显式参数优先于用户设置里的默认岗位；未知 id 回退全部。
 */
export default async function MapPage(
  { searchParams }: { searchParams: Promise<{ track?: string }> },
): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId

  const { track: trackParam } = await searchParams
  const tracks = await loadTracks(getDb())
  const knownTrack = (id: string | null): string | null =>
    id !== null && tracks.some(t => t.id === id) ? id : null

  if (userId === undefined) {
    // 匿名目录：只用 blocks 表（题量），不查用户设置/卡状态——零身份数据
    const blocks = await loadBlocks(getDb())
    const entries: BlockMapEntry[] = blocks.map(b => ({
      ...b, unlocked: false, mastery: { kind: 'untried' },
    }))
    const trackId = knownTrack(trackParam ?? null)
    const filtered = filterEntriesByTrack(entries, tracks, trackId)
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
        authed={false}
      />
    )
  }

  const [entries, settings] = await Promise.all([
    buildBlockMap(mapDepsOf(getDb(), userId)),
    loadSettings(getDb(), userId),
  ])
  const trackId = knownTrack(trackParam ?? settings.trackId)
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
