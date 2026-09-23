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
    >
      <div>
        <label htmlFor="settings-ready-by">就绪日</label>
        <input
          id="settings-ready-by"
          type="date"
          value={readyByDate}
          onChange={e => {
            setReplanned(null)
            setReadyByDate(e.target.value)
          }}
        />
      </div>

      <div>
        <label htmlFor="settings-capacity">每日容量</label>
        <input
          id="settings-capacity"
          type="number"
          value={dailyCapacity}
          onChange={e => {
            setReplanned(null)
            setDailyCapacity(Number(e.target.value))
          }}
        />
      </div>

      <fieldset>
        <legend>块选择</legend>
        {view.blocks.map(b => (
          <label key={b.blockId}>
            <input
              type="checkbox"
              name={b.blockId}
              checked={selected.has(b.blockId)}
              onChange={() => toggle(b.blockId)}
            />
            {b.blockName}（{b.cardCount} 题）
          </label>
        ))}
      </fieldset>

      {overLimit ? <p role="alert">免费层最多选 {FREE_BLOCK_LIMIT} 个块</p> : null}

      <button type="submit" disabled={overLimit}>保存</button>

      {replanned !== null ? <p>已重排 {replanned} 张卡的计划</p> : null}
    </form>
  )
}
