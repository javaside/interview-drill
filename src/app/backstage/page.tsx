import { getServerSession } from 'next-auth'
import { authOptions } from '../../server/auth-config.js'
import { getDb } from '../../server/db/client.js'
import { isAdminUser } from '../../server/admin.js'
import { BackstageView } from './BackstageView.js'

export const dynamic = 'force-dynamic'

/**
 * 后台入口（路径刻意避开 /admin——常见扫描目标，不进导航）。
 * 登录 + ADMIN_GITHUB_IDS 白名单（github_id 比对）才放行 BackstageView；
 * 其余一律渲染同一张「无权限」卡（不区分未登录/名单外，不泄判定细节）。
 */
export default async function BackstagePage(): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId
  const admin = userId !== undefined
    && await isAdminUser({ db: getDb(), adminGithubIds: process.env.ADMIN_GITHUB_IDS ?? '' }, userId)
  if (!admin) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24">
        <div className="card-flat p-10 text-center">
          <h1 className="text-lg font-bold text-paper-ink">这里没有你要找的东西</h1>
          <p className="mt-3 text-sm text-paper-muted">页面不存在，或你没有访问权限。</p>
          <a href="/" className="mt-6 inline-block text-sm text-paper-muted underline decoration-paper-line hover:text-paper-ink">
            回首页
          </a>
        </div>
      </div>
    )
  }
  return <BackstageView />
}
