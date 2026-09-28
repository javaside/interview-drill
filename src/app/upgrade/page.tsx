import { PRICE_CENTS } from '../../lib/billing/order.js'
import { UpgradeView } from './UpgradeView.js'

/**
 * 购买页（server component，§10.1）：价格常量服务端注入，客户端组件只做展示与下单。
 */
export default function UpgradePage(): React.JSX.Element {
  return <UpgradeView priceCents={PRICE_CENTS} />
}
