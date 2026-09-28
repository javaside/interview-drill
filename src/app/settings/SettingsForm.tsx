'use client'

import { useState } from 'react'
import { FREE_BLOCK_LIMIT } from '../../lib/entitlement/entitlement.js'
import { browserApi, type Api } from '../../client/api.js'
import type { SettingsView } from '../../server/settings.js'

/**
 * 设置屏（§5.5/§10.1，Task 11）——`'use client'`：
 * - 就绪日 `<input type="date">`、容量 `<input type="number">`（`<label htmlFor>` 关联）。
 * - 块 checkbox 列表（`selected` 预勾），accessible name = 块名，供 getByRole('checkbox',{name}) 命中。
 * - 免费层选中数 > FREE_BLOCK_LIMIT(=2) → 提交禁用 + 提示「最多选 2 个块」（§10.1）。
 * - 保存：先 postSettings（就绪日/容量重排），再 postBlocks（块集 diff），回显 replanned。
 * `api` 可选：server component 不传，client 侧默认 browserApi()。
 */
export function SettingsForm(
  { view, api }: { view: SettingsView; api?: Pick<Api, 'postSettings' | 'postBlocks'> },
): React.JSX.Element {
  const client = api ?? browserApi()
  const [readyByDate, setReadyByDate] = useState<string>(view.readyByDate ?? '')
  const [dailyCapacity, setDailyCapacity] = useState<number>(view.dailyCapacity)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(view.blocks.filter(b => b.selected).map(b => b.blockId)),
  )
  const [replanned, setReplanned] = useState<number | null>(null)

  const overLimit = view.plan === 'free' && selected.size > FREE_BLOCK_LIMIT

  function toggle(blockId: string): void {
    setReplanned(null)
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
  }

  async function save(): Promise<void> {
    const { replanned: n } = await client.postSettings({
      readyByDate: readyByDate === '' ? null : (readyByDate as SettingsView['readyByDate']),
      dailyCapacity,
    })
    await client.postBlocks({ blockIds: [...selected] })
    setReplanned(n)
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        void save()
      }}
      className="mx-auto max-w-2xl px-5 py-8"
    >
      <h1 className="mb-6 font-serif text-xl font-semibold text-paper-ink">设置</h1>

      <div className="mb-6">
        <label htmlFor="settings-ready-by" className="mb-1.5 block text-xs tracking-[0.2em] text-paper-muted">
          就绪日（面试日期）
        </label>
        <input
          id="settings-ready-by"
          type="date"
          value={readyByDate}
          onChange={e => {
            setReplanned(null)
            setReadyByDate(e.target.value)
          }}
          className="tnum rounded-md border border-paper-line bg-paper-card px-3 py-2 text-paper-ink transition-colors focus:border-paper-ink focus:outline-none"
        />
      </div>

      <div className="mb-8">
        <label htmlFor="settings-capacity" className="mb-1.5 block text-xs tracking-[0.2em] text-paper-muted">
          每日容量（题）
        </label>
        <input
          id="settings-capacity"
          type="number"
          value={dailyCapacity}
          onChange={e => {
            setReplanned(null)
            setDailyCapacity(Number(e.target.value))
          }}
          className="tnum w-28 rounded-md border border-paper-line bg-paper-card px-3 py-2 text-paper-ink transition-colors focus:border-paper-ink focus:outline-none"
        />
        <p className="mt-1.5 text-xs text-paper-muted">排期按此容量把冲刺计划摊到每天</p>
      </div>

      <fieldset>
        <legend className="mb-3 text-xs tracking-[0.2em] text-paper-muted">
          块选择{view.plan === 'free' ? `（免费最多 ${FREE_BLOCK_LIMIT} 个）` : ''}
        </legend>
        <ul className="space-y-2">
          {view.blocks.map(b => (
            <li key={b.blockId}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-paper-line bg-paper-card px-4 py-3 text-[15px] transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent-soft hover:border-paper-muted">
                <input
                  type="checkbox"
                  name={b.blockId}
                  checked={selected.has(b.blockId)}
                  onChange={() => toggle(b.blockId)}
                />
                <span className="flex-1">{b.blockName}</span>
                <span className="tnum shrink-0 text-sm text-paper-muted">{b.cardCount} 题</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {overLimit ? (
        <p role="alert" className="mt-4 text-sm text-mark-bad">免费层最多选 {FREE_BLOCK_LIMIT} 个块</p>
      ) : null}

      <button
        type="submit"
        disabled={overLimit}
        className="mt-8 rounded-md bg-paper-ink px-8 py-2.5 font-medium text-paper transition-all hover:opacity-90 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink disabled:pointer-events-none disabled:opacity-30"
      >
        保存
      </button>

      {replanned !== null ? (
        <p className="mt-4 text-sm text-mark-good">已重排 {replanned} 张卡的计划</p>
      ) : null}
    </form>
  )
}
