'use client'
import Link from 'next/link'
import { useState } from 'react'
import { browserApi } from '../../client/api.js'
import type { Api } from '../../client/api.js'

/**
 * 解锁页视图（§10.1 唯一转化入口的落地页——产品内仅此一处付费提示）。
 *
 * 2026-10-02 v3：付费是 **30 天通行证**（不自动续费，可叠加续期）。三种状态：
 * - access='paid'：有效期内，出剩余天数 + 续期入口（**不隐藏输码框**——可叠加，
 *   藏起来等于骗用户「不能续」；剩余天数只出现在本页，导航不放，§10.1 定过
 *   产品内不得有第二处付费提示）；
 * - access='grace'：已到期但在宽限期（在期排的题跑到宽限截止），必须如实说明
 *   「已到期」而不是「已解锁」——否则用户不知道要续期；
 * - access='free'：无通行证，输码解锁。
 * - access=null（匿名）：可看页可输码，点兑换时提示先登录（动作时刻要身份）。
 */
export function UpgradeView({
  priceCents, access, daysLeft, graceUntil, api,
}: {
  priceCents: number
  /** null = 未登录；paid = 有效期内；grace = 宽限期内（已到期）；free = 无通行证 */
  access: 'free' | 'paid' | 'grace' | null
  /** access='paid' 时剩余天数；其余为 null */
  daysLeft: number | null
  /** access='grace' 时宽限截止日（YYYY-MM-DD）；其余为 null */
  graceUntil: string | null
  api?: Pick<Api, 'postRedeem'>
}): React.JSX.Element {
  const a = api ?? browserApi()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 兑换成功后本页进入解锁态（宽限期兑码同样落这里）
  const [justRedeemed, setJustRedeemed] = useState(false)
  const active = access === 'paid' || justRedeemed

  async function redeem(): Promise<void> {
    if (access === null) {
      setError('请先登录，再兑换邀请码')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await a.postRedeem(code)
      setJustRedeemed(true)
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
        <p className="tnum mt-4 font-mono text-5xl font-semibold text-paper-ink">
          ¥{priceCents / 100}
          <span className="ml-2 font-sans text-xl text-paper-muted">/ 30 天</span>
        </p>
        <p className="mt-3 text-sm text-paper-muted">30 天通行证 · 全部知识块 · 不自动续费</p>

        {access === 'grace' && (
          <p className="mt-6 text-sm text-paper-muted">
            通行证已到期 · 已排的题可以刷到 {graceUntil}
          </p>
        )}

        {active ? (
          <div className="mt-10">
            <p
              data-testid="unlocked-badge"
              className="inline-block rounded-lg border border-accent/50 bg-accent/15 px-5 py-2.5 font-semibold text-accent"
            >
              {justRedeemed
                ? '已续上 30 天'
                : `通行证有效${daysLeft === null ? '' : ` · 还剩 ${daysLeft} 天`}`}
            </p>
            {/* 解锁不改变排期范围，且兑换会把勾选清空（free_block_ids 置空，不留旧勾选、也不默认全选）：
                所以下一个动作是去设置把要刷的岗位一键加回来——别写成「保留原勾选」，实际不会。 */}
            <p className="mt-4 text-sm text-paper-muted">全部块已可自由刷；每日排期要刷哪些，去设置一键勾上</p>
            <p className="mt-3 text-xs text-paper-muted">到期后已排的题会跑完，不会中途断</p>
            <p className="mt-2 flex items-center justify-center gap-4">
              <Link href="/settings" data-testid="goto-settings"
                className="text-sm text-paper-muted underline decoration-paper-line transition-colors duration-150 ease-snap hover:text-paper-ink hover:decoration-paper-muted">
                去设置选岗位
              </Link>
              <Link href="/map" className="text-sm text-paper-muted underline decoration-paper-line transition-colors duration-150 ease-snap hover:text-paper-ink hover:decoration-paper-muted">
                去刷题
              </Link>
            </p>
            <div className="mt-10 border-t border-paper-line pt-8">
              <p className="eyebrow">再续 30 天</p>
              <p className="mt-2 text-xs text-paper-muted">从现有到期日往后加，剩余天数不会被覆盖</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <CodeInput code={code} setCode={setCode} />
                <button
                  type="button"
                  onClick={() => { void redeem() }}
                  disabled={busy || code.trim() === ''}
                  className="btn-primary shrink-0"
                >
                  {busy ? '兑换中…' : '用邀请码续期'}
                </button>
              </div>
              {error !== null && (
                <p role="alert" className="mt-4 text-sm text-paper-ink">{error}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-10">
            <p className="eyebrow">邀请码</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <CodeInput code={code} setCode={setCode} />
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

/** 邀请码输入框（解锁态与续期态共用，样式只有这一份） */
function CodeInput({
  code, setCode,
}: { code: string; setCode: (v: string) => void }): React.JSX.Element {
  return (
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
  )
}
