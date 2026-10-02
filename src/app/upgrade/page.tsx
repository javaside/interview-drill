import { getServerSession } from 'next-auth'
import { PASS_PRICE_CENTS } from '../../lib/billing/order.js'
import { authOptions } from '../../server/auth-config.js'
import { getDb } from '../../server/db/client.js'
import { loadSettings, accessStateOfRow } from '../../server/db/adapters.js'
import { UpgradeView } from './UpgradeView.js'

export const dynamic = 'force-dynamic'

const DAY_MS = 86400_000

/**
 * 解锁页（§10.1 唯一转化入口）：价格常量服务端注入；
 * 登录用户的**档位**（paid/grace/free）与剩余天数一并下发——已解锁的直接显示
 * 解锁态，宽限期的如实显示「已到期、可刷到 X 日」，免得用户不知道要续期。
 * 匿名可看（营销页），兑换动作时才要身份。
 */
export default async function UpgradePage(): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId
  if (userId === undefined) {
    return <UpgradeView priceCents={PASS_PRICE_CENTS} access={null} daysLeft={null} graceUntil={null} />
  }
  const nowMs = Date.now()
  const row = await loadSettings(getDb(), userId, nowMs)
  const access = accessStateOfRow(row, nowMs)
  const daysLeft = access === 'paid' && row.paidUntil !== null
    // 向上取整且至少 1：还剩 3 小时显示「1 天」而不是「0 天」（0 天听起来已过期）
    ? Math.max(1, Math.ceil((row.paidUntil.getTime() - nowMs) / DAY_MS))
    : null
  return (
    <UpgradeView
      priceCents={PASS_PRICE_CENTS}
      access={access}
      daysLeft={daysLeft}
      graceUntil={access === 'grace' ? row.graceUntil : null}
    />
  )
}
