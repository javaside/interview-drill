import { getServerSession } from 'next-auth'
import { PRICE_CENTS } from '../../lib/billing/order.js'
import { authOptions } from '../../server/auth-config.js'
import { getDb } from '../../server/db/client.js'
import { loadSettings } from '../../server/db/adapters.js'
import { UpgradeView } from './UpgradeView.js'

export const dynamic = 'force-dynamic'

/**
 * 解锁页（§10.1 唯一转化入口）：价格常量服务端注入；
 * 登录用户的 plan 一并下发——已解锁的直接显示已解锁态，免得白输一码。
 * 匿名可看（营销页），兑换动作时才要身份。
 */
export default async function UpgradePage(): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  const userId = (session as { userId?: string } | null)?.userId
  const plan = userId === undefined ? null : (await loadSettings(getDb(), userId)).plan
  return <UpgradeView priceCents={PRICE_CENTS} plan={plan} />
}
