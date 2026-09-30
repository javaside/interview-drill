import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { withBase } from '../../lib/base-path.js'
import { getDb } from '../../server/db/client.js'
import { loadSettingsView } from '../../server/settings.js'
import { authOptions } from '../../server/auth-config.js'
import { SettingsForm } from './SettingsForm.js'

export const dynamic = 'force-dynamic'

/**
 * 设置屏入口（server component，§5.5/§10.1）：从 NextAuth session 取 userId（对齐 route 口径），
 * 直接调 loadSettingsView 取可序列化视图（不经 HTTP）→ 交给 client 表单。
 * RSC 边界纪律：只传可序列化 view，不传 api（client 侧默认 browserApi()）。
 */
export default async function SettingsPage(): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId
  if (userId === undefined) redirect(withBase('/api/auth/signin'))

  const view = await loadSettingsView({ db: getDb(), serverNowMs: Date.now() }, userId)
  return <SettingsForm view={view} />
}
