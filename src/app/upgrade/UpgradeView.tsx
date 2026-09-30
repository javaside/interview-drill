'use client'
import { useState } from 'react'
import { browserApi } from '../../client/api.js'
import type { Api } from '../../client/api.js'

/**
 * 解锁页视图（§10.1 唯一转化入口的落地页——产品内仅此一处付费提示）。
 * 在线支付未上线（假网关），现阶段唯一可用通道 = 邀请码兑换：
 * - plan='paid'：已解锁态，不出输入框；
 * - plan='free'：输码 → postRedeem；fulfilled/already 都落已解锁态；
 *   服务端中文错误（无效/已用）经 readJson.errorOf 进 role=alert，可重试；
 * - plan=null（匿名）：可看页可输码，点兑换时提示先登录（动作时刻要身份）。
 */
export function UpgradeView({
  priceCents, plan, api,
}: {
  priceCents: number
  /** null = 未登录；'free' | 'paid' = 登录用户当前档位 */
  plan: 'free' | 'paid' | null
  api?: Pick<Api, 'postRedeem'>
}): React.JSX.Element {
  const a = api ?? browserApi()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(plan === 'paid')

  async function redeem(): Promise<void> {
    if (plan === null) {
      setError('请先登录，再兑换邀请码')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await a.postRedeem(code)
      setUnlocked(true)   // fulfilled 与 already 都算已解锁
    } catch (e) {
      setError(e instanceof Error ? e.message : '兑换失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="rounded-2xl border border-paper-line bg-paper-card px-8 py-12 text-center">
        <h1 className="font-sans text-2xl font-extrabold tracking-tight text-paper-ink">解锁全部题库</h1>
        <p className="tnum mt-4 font-mono text-5xl font-semibold text-paper-ink">¥{priceCents / 100}</p>
        <p className="mt-3 text-sm text-paper-muted">一次性买断 · 全部知识块 · 无订阅</p>

        {unlocked ? (
          <div className="mt-10">
            <p
              data-testid="unlocked-badge"
              className="inline-block rounded-lg border border-accent/50 bg-accent/15 px-5 py-2.5 font-semibold text-accent"
            >
              已解锁全部题库
            </p>
            <p className="mt-4">
              <a href="/map" className="text-sm text-paper-muted underline decoration-paper-line transition-colors duration-150 ease-snap hover:text-paper-ink hover:decoration-paper-muted">
                去刷题
              </a>
            </p>
          </div>
        ) : (
          <div className="mt-10">
            <p className="eyebrow">邀请码</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                aria-label="邀请码"
                autoComplete="off"
                spellCheck={false}
                className="tnum w-full rounded-lg border border-paper-line bg-paper px-4 py-3 font-mono text-base uppercase tracking-wider text-paper-ink transition-colors duration-150 ease-snap placeholder:text-paper-muted/60 focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => { void redeem() }}
                disabled={busy || code.trim() === ''}
                className="btn-primary shrink-0"
              >
                {busy ? '兑换中…' : '用邀请码解锁'}
              </button>
            </div>
            {error !== null && (
              <p role="alert" className="mt-4 text-sm text-paper-ink">{error}</p>
            )}
            <p className="mt-5 text-xs text-paper-muted">在线支付即将上线，现阶段凭邀请码解锁</p>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-paper-muted">
        排期与刷题功能永久免费，解锁的只是题量
      </p>
    </div>
  )
}
