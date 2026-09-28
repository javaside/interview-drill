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
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="rounded-lg border border-paper-line bg-paper-card px-8 py-12 text-center">
        <h1 className="font-serif text-2xl font-semibold text-paper-ink">解锁全部题库</h1>
        <p className="mt-4 font-serif text-5xl font-bold tracking-tight text-paper-ink">
          ¥{priceCents / 100}
        </p>
        <p className="mt-3 text-sm text-paper-muted">一次性买断 · 全部知识块 · 无订阅</p>
        <button
          onClick={async () => {
            await a.postCreateOrder()
            setStarted(true)
          }}
          className="mt-8 rounded-md bg-accent px-10 py-3 font-medium text-paper transition-all hover:opacity-90 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          立即解锁全部题库
        </button>
        {started && <p className="mt-4 text-sm text-paper-muted">支付发起中…</p>}
      </div>
      <p className="mt-4 text-center text-xs text-paper-muted">
        排期与刷题功能永久免费，解锁的只是题量
      </p>
    </div>
  )
}
