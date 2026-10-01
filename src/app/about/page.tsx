import { getDb } from '../../server/db/client.js'
import { loadBlocks, loadTracks } from '../../server/db/adapters.js'
import { Landing } from '../(drill)/Landing.js'

export const dynamic = 'force-dynamic'

// 这一页最常被分享，标题带上「怎么练」比只留品类词更有信息量
export const metadata = { title: '划重点 · 后端面试题怎么练' }

/**
 * 产品介绍页（稳定地址 /drill/about）——**复用匿名首页那一个 Landing 组件**，
 * 内容零重复、改一处两处同步。
 *
 * 为什么单独要个地址：登录后首页是刷题界面、看不到介绍，而介绍页恰恰是最该
 * 发给别人的那一页（写简历、发群里、朋友问你「这啥」）。页脚常驻入口。
 *
 * 数据口径与匿名首页完全一致：只读 blocks/tracks（题量与岗位名），
 * 零用户数据查询——匿名可访问。
 */
export default async function AboutPage(): Promise<React.JSX.Element> {
  const blocks = await loadBlocks(getDb())
  const tracks = await loadTracks(getDb())
  const totals = {
    cards: blocks.reduce((n, b) => n + b.cardCount, 0),
    blocks: blocks.length,
    categories: new Set(blocks.map(b => b.category)).size,
  }
  return <Landing totals={totals} tracks={tracks.map(t => t.name)} />
}
