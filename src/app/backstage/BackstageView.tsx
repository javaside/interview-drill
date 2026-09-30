'use client'
import { useEffect, useState } from 'react'
import { browserApi } from '../../client/api.js'
import type { Api } from '../../client/api.js'

type LedgerRow = Awaited<ReturnType<Api['fetchInviteCodes']>>[number]

/** ISO 时间 → 本地可读（台账展示用，不追秒级精确） */
function fmt(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

/**
 * 后台视图（/backstage，仅管理员可达——page 判定，View 只管功能）：
 * - 铸码：数量+备注 → 明文码当场逐张展示 + 一键复制（仅此一次，库里只有哈希）；
 * - 台账：全部码的备注/时间/状态（明文不可找回，hash 前缀仅作行识别）。
 */
export function BackstageView({ api }: { api?: Pick<Api, 'fetchInviteCodes' | 'postMintInvites'> }): React.JSX.Element {
  const a = api ?? browserApi()
  const [n, setN] = useState('1')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    a.fetchInviteCodes().then(setLedger).catch(e => setError(e instanceof Error ? e.message : '台账加载失败'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function mint(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const { codes } = await a.postMintInvites(Number(n), note)
      setCodes(codes)
      setLedger(await a.fetchInviteCodes())   // 台账同步刷新
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  async function copy(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* 剪贴板被拒（非安全上下文等）——按钮文案不变，用户手选 */ }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 pb-28 pt-8" data-testid="backstage">
      <header>
        <p className="eyebrow">后台</p>
        <h1 className="mt-2 font-sans text-2xl font-extrabold tracking-tight text-paper-ink">邀请码</h1>
      </header>

      {/* ===== 铸码 ===== */}
      <section className="card-flat mt-6 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm text-paper-muted">数量</span>
            <input
              type="number" min={1} value={n} onChange={e => setN(e.target.value)}
              aria-label="数量"
              className="tnum w-24 rounded-lg border border-paper-line bg-paper px-3 py-2.5 font-mono text-base text-paper-ink focus:border-accent focus:outline-none"
            />
          </label>
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1.5 block text-sm text-paper-muted">备注（发给谁）</span>
            <input
              type="text" value={note} onChange={e => setNote(e.target.value)}
              aria-label="备注" placeholder="如：张三 / 内测第一批"
              className="w-full rounded-lg border border-paper-line bg-paper px-3 py-2.5 text-[15px] text-paper-ink placeholder:text-paper-muted/60 focus:border-accent focus:outline-none"
            />
          </label>
          <button type="button" onClick={() => { void mint() }} disabled={busy} className="btn-primary">
            {busy ? '生成中…' : '生成邀请码'}
          </button>
        </div>
        {error !== null && <p role="alert" className="mt-4 text-sm text-paper-ink">{error}</p>}

        {codes !== null && codes.length > 0 && (
          <div className="mt-6 rounded-lg border border-accent/50 bg-accent/10 p-4" data-testid="mint-result">
            <p className="text-sm font-semibold text-paper-ink">
              已生成 {codes.length} 张——明文仅此一次，请立即复制保存：
            </p>
            <ul className="mt-3 space-y-2">
              {codes.map(c => (
                <li key={c} className="flex items-center justify-between gap-4">
                  <code className="tnum font-mono text-base font-semibold tracking-wider text-paper-ink">{c}</code>
                  <button
                    type="button" onClick={() => { void copy(c) }}
                    className="rounded-lg border border-paper-line bg-paper px-3 py-1.5 text-sm text-paper-muted transition-colors duration-150 ease-snap hover:border-paper-muted hover:text-paper-ink"
                  >
                    {copied === c ? '已复制' : '复制'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ===== 台账 ===== */}
      <section className="mt-10">
        <div className="mb-4 flex items-baseline gap-4">
          <h2 className="text-lg font-bold text-paper-ink">台账</h2>
          <span aria-hidden="true" className="h-px flex-1 bg-paper-line" />
          <span className="font-mono text-xs text-paper-muted">{ledger?.length ?? 0} 张</span>
        </div>
        {ledger === null ? (
          <p className="py-8 text-center text-sm text-paper-muted">加载中…</p>
        ) : ledger.length === 0 ? (
          <p className="py-8 text-center text-sm text-paper-muted">还没铸过码</p>
        ) : (
          <ul className="card-flat divide-y divide-paper-line">
            {ledger.map(row => (
              <li key={row.id} data-testid={`invite-${row.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5">
                <span className="font-mono text-xs text-paper-muted/70">{row.hashPrefix}…</span>
                <span className="min-w-[8rem] flex-1 text-[15px] text-paper-ink">{row.note ?? '（无备注）'}</span>
                <span className="font-mono text-xs text-paper-muted">铸于 {fmt(row.createdAt)}</span>
                {row.usedAt !== null ? (
                  <span className="rounded-md bg-paper-wash px-2.5 py-1 text-xs font-semibold text-paper-muted">
                    被 {row.usedByLogin ?? `#${row.usedByGithubId}`} 兑换 {fmt(row.usedAt)}
                  </span>
                ) : (
                  <span className="rounded-md bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">未用</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-paper-muted">明文找回不可能——库里只有哈希；丢了的码作废重铸即可。</p>
      </section>
    </div>
  )
}
