'use client'

import { useState } from 'react'
import { FREE_BLOCK_LIMIT } from '../../lib/entitlement/entitlement.js'
import { browserApi, type Api } from '../../client/api.js'
import type { SettingsView } from '../../server/settings.js'
import type { LocalDate } from '../../lib/scheduler/date.js'

/**
 * 设置屏（§5.5/§10.1，Task 11）——`'use client'`：
 * - 就绪日 `<input type="date">`、容量 `<input type="number">`（`<label htmlFor>` 关联）。
 * - 块 checkbox 列表（`selected` 预勾），accessible name = 块名，供 getByRole('checkbox',{name}) 命中。
 * - 免费层选中数 > FREE_BLOCK_LIMIT(=2) → 提交禁用 + 提示「最多选 2 个块」（§10.1）。
 * - 保存：先 postSettings（就绪日/容量重排），再 postBlocks（块集 diff），回显 replanned。
 * `api` 可选：server component 不传，client 侧默认 browserApi()。
 */
export function SettingsForm(
  { view, api }: { view: SettingsView; api?: Pick<Api, 'postSettings' | 'postBlocks' | 'postCram'> },
): React.JSX.Element {
  const client = api ?? browserApi()
  const [readyByDate, setReadyByDate] = useState<string>(view.readyByDate ?? '')
  const [dailyCapacity, setDailyCapacity] = useState<number>(view.dailyCapacity)
  const [trackId, setTrackId] = useState<string>(view.trackId ?? '')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(view.blocks.filter(b => b.selected).map(b => b.blockId)),
  )
  const [replanned, setReplanned] = useState<number | null>(null)
  const [examDate, setExamDate] = useState<string>('')
  const [cramResult, setCramResult] = useState<{ crammed: number; excluded: number; overloaded: boolean } | null>(null)

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
      trackId: trackId === '' ? null : trackId,
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
      className="rise mx-auto max-w-2xl px-5 py-8"
    >
      <h1 className="mb-8 font-serif text-3xl font-semibold tracking-tight text-paper-ink">设置</h1>

      {view.tracks.length > 0 && (
        <fieldset className="mb-8">
          <legend className="eyebrow mb-3 block">面试岗位</legend>
          <ul className="space-y-2">
            <li>
              <label className="choice">
                <input
                  type="radio"
                  name="track"
                  checked={trackId === ''}
                  onChange={() => setTrackId('')}
                />
                <span className="flex-1">全部</span>
              </label>
            </li>
            {view.tracks.map(t => (
              <li key={t.id}>
                <label className="choice">
                  <input
                    type="radio"
                    name="track"
                    value={t.id}
                    checked={trackId === t.id}
                    onChange={() => setTrackId(t.id)}
                  />
                  <span className="flex-1">
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-2 text-xs text-paper-muted">{t.tagline}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-paper-muted">
            岗位决定地图与学习的默认视野（块的推荐集合），不影响排期与免费块额度
          </p>
        </fieldset>
      )}

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
        <p className="mt-1.5 text-xs text-paper-muted">
          留空 = 常备模式：滚动间隔复习，随时保持题感；有明确面试日再填，排期按当天记忆峰值冲刺
        </p>
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
        <legend className="eyebrow mb-3 block">
          块选择{view.plan === 'free' ? `（免费最多 ${FREE_BLOCK_LIMIT} 个）` : ''}
        </legend>
        {(() => {
          // 按大类分组（对齐知识地图的分组视角），保持 view.blocks 的原始顺序
          const groups = new Map<string, typeof view.blocks>()
          for (const b of view.blocks) {
            const arr = groups.get(b.category) ?? []
            arr.push(b)
            groups.set(b.category, arr)
          }
          return [...groups.entries()].map(([category, list]) => (
            <section key={category} className="mb-6 last:mb-0">
              <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-paper-muted">{category}</h3>
              <ul className="mt-2.5 space-y-2">
                {list.map(b => (
                  <li key={b.blockId}>
                    <label className="choice">
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
            </section>
          ))
        })()}
      </fieldset>

      {overLimit ? (
        <p role="alert" className="mt-4 text-sm text-mark-bad">免费层最多选 {FREE_BLOCK_LIMIT} 个块</p>
      ) : null}

      <button
        type="submit"
        disabled={overLimit}
        className="btn-primary mt-8 w-full sm:w-auto"
      >
        保存
      </button>

      {replanned !== null ? (
        <p className="mt-4 text-sm text-mark-good">已重排 {replanned} 张卡的计划</p>
      ) : null}

      <fieldset className="paper-card mt-14 px-6 py-6">
        <legend className="eyebrow px-1">临时加密</legend>
        <p className="mt-1 text-sm leading-relaxed text-paper-muted">
          约到面试了？填上日期，对当前勾选的块在面试前重铺冲刺；面试一过自动回到常备模式。
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="cram-exam-date" className="mb-1.5 block text-xs tracking-[0.2em] text-paper-muted">
              面试日期
            </label>
            <input
              id="cram-exam-date"
              type="date"
              value={examDate}
              onChange={e => {
                setCramResult(null)
                setExamDate(e.target.value)
              }}
              className="tnum rounded-md border border-paper-line bg-paper px-3 py-2 text-paper-ink transition-colors focus:border-paper-ink focus:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={examDate === '' || selected.size === 0}
            onClick={async () => {
              const r = await client.postCram({ examDate: examDate as LocalDate, blockIds: [...selected] })
              setCramResult(r)
            }}
            className="rounded-md bg-accent px-6 py-2 font-medium text-paper transition-all hover:opacity-90 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30"
          >
            临时加密
          </button>
        </div>
        {cramResult !== null && (
          <p className="tnum mt-3 text-sm" data-testid="cram-result">
            已加密 {cramResult.crammed} 张
            {cramResult.excluded > 0 && `（${cramResult.excluded} 张窗口不足）`}
            {cramResult.overloaded && ' · 部分日子超容量'}
          </p>
        )}
      </fieldset>
    </form>
  )
}
