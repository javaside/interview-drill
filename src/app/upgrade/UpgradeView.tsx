'use client'
import { useState } from 'react'
import { browserApi } from '../../client/api.js'
import type { Api } from '../../client/api.js'

/**
 * 购买页视图（§10.1 唯一转化入口的落地页——产品内仅此一处付费提示）。
 * 一次性买断、价格由服务端 PRICE_CENTS 决定；点击「立即解锁」调 postCreateOrder
 * 拿 payParams 后交网关拉起支付。假网关下 payParams 是哑数据，仅置「支付发起中」态；
 * 真实网关 SDK 的拉起逻辑待商户资质就绪后在此接入（薄壳，业务全在纯核）。
 */
export function UpgradeView({
  priceCents, api,
}: { priceCents: number; api?: Pick<Api, 'postCreateOrder'> }): React.JSX.Element {
  const a = api ?? browserApi()
  const [started, setStarted] = useState(false)
  return (
    <div>
      <h1>解锁全部题库</h1>
      <p>¥{priceCents / 100} · 一次性买断</p>
      <button
        onClick={async () => {
          await a.postCreateOrder()
          setStarted(true)
        }}
      >
        立即解锁全部题库
      </button>
      {started && <span>支付发起中…</span>}
    </div>
  )
}
