'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { FREE_BLOCK_LIMIT } from '../../lib/entitlement/entitlement.js'
import { browserApi, type Api } from '../../client/api.js'
import type { SettingsView } from '../../server/settings.js'
import type { LocalDate } from '../../lib/scheduler/date.js'

/**
 * 设置屏（§5.5/§10.1，Task 11；交互重整 2026-09-28；反馈语义重整 2026-09-30）——`'use client'`：
 * - **整页重排（v3，2026-09-30）**：黑话清零 + sticky 保存条——「临时加密」→「面试冲刺」、
 *   「冲刺截止日（就绪日）」→「目标日期（可选）」、「每日容量」→「每天刷几题」；
 *   说明每条压到一行（细节留给动作发生时的反馈）；容量与目标日期并排一行；
 *   保存按钮 + 状态（错误 > 结果 > 未保存变更 > 已保存）合成 sticky 贴底操作条，
 *   块列表再长改到哪都能就地保存。顺序 = 岗位 → 节奏 → 块选择 → 保存条 → 面试冲刺。
 * - **两个独立 form**：设置区与面试冲刺区——此前整页一个 form，冲刺日期框
 *   按 Enter 会误触「保存设置」全局重排。
 * - **已保存基线**：saved（目标日期/容量/岗位）+ savedBlockIds（块集）双向快照，
 *   推导 formDirty——保存成功 / cram 写入目标日期后同步基线，不误报。
 * - **保存反馈按语义分流**：服务端 changed=true（目标日期/容量实际变更）→ 重排三态；
 *   changed=false 但确有块集/岗位变更 → 「已保存，排期未重排」——此前一律显示
 *   「设置未变化」，把「排期未变」错说成「设置未变」。
 * - **cram 作用已保存块集**（savedBlockIds）：有未保存勾选时冲刺禁用；成功后用
 *   返回的 readyByDate 同步表单**并更新基线**，结果明示「目标日期 → X」副作用。
 * - **岗位联动（无过滤）**：块列表永远全量展示、勾哪刷哪；岗位包含的块常挂
 *   「推荐」徽标 + 一行小字说明——此前「只看岗位内块/推荐-全部视野切换」把内部
 *   概念泄漏给用户（用户实测：看不懂什么叫推荐什么叫全部），过滤还制造
 *   「视野外已选块」的解释负担，全部删除。措辞上「勾选 = 要刷的块」与
 *   「推荐 = 岗位包含」严格分离，不再共用「选」字。
 * - **免费墙即时防呆**：勾满额度的瞬间提示插在**刚勾的那一行后面**（视线焦点处），
 *   块区顶部另有 sticky 提示随滚动贴住视口；未勾选块变灰禁用（hover 有 title）——
 *   此前超限提示挂在列表底部，拉到保存键才看见（用户实测反馈）。
 * - **错误链路**：errorResponse(400 {error}) → readJson 透传中文消息到 role=alert；
 *   两步请求（postSettings → postBlocks）第二步失败时明说「设置已保存，块集未更新」。
 * `api` 可选：server component 不传，client 侧默认 browserApi()。
 */

function msgOf(e: unknown): string {
  return e instanceof Error ? e.message : '请求失败，请重试'
}

/** 浏览器本地今天（YYYY-MM-DD）；挂载后填充，避免 SSR 与客户端时区不一致的 hydration 抖动 */
function useLocalToday(): string {
  const [today, setToday] = useState('')
  useEffect(() => {
    const d = new Date()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setToday(`${d.getFullYear()}-${mm}-${dd}`)
  }, [])
  return today
}

export function SettingsForm(
  { view, api }: { view: SettingsView; api?: Pick<Api, 'postSettings' | 'postBlocks' | 'postCram'> },
): React.JSX.Element {
  const client = api ?? browserApi()
  const [readyByDate, setReadyByDate] = useState<string>(view.readyByDate ?? '')
  const [dailyCapacity, setDailyCapacity] = useState<number>(view.dailyCapacity)
  // 已保存基线：与表单 state 对比得「未保存变更」；保存/cram 成功后同步
  const [saved, setSaved] = useState<{ readyByDate: string; dailyCapacity: number }>(
    () => ({ readyByDate: view.readyByDate ?? '', dailyCapacity: view.dailyCapacity }),
  )
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(view.blocks.filter(b => b.selected).map(b => b.blockId)),
  )
  const [savedBlockIds, setSavedBlockIds] = useState<Set<string>>(
    () => new Set(view.blocks.filter(b => b.selected).map(b => b.blockId)),
  )
  const [lastToggled, setLastToggled] = useState<string | null>(null)   // 免费墙提示挂在其行后（勾满瞬间或拒绝点击处）
  const [trackPicked, setTrackPicked] = useState<string | null>(null)   // 岗位配题反馈（已按某岗位勾选 N 块）
  const [saving, setSaving] = useState(false)
  const [cramming, setCramming] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ kind: 'plan' | 'nav' | 'none'; replanned: number } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [examDate, setExamDate] = useState<string>('')
  const [cramResult, setCramResult] = useState<{ crammed: number; excluded: number; overloaded: boolean; readyByDate: LocalDate | null } | null>(null)
  const [cramError, setCramError] = useState<string | null>(null)
  const today = useLocalToday()

  const overLimit = view.plan === 'free' && selected.size > FREE_BLOCK_LIMIT
  // 免费墙即时防呆：勾满额度那一刻就提示并锁住其余块——
  // 此前超限提示挂在块列表底部，用户拉到保存键才看见，反馈与动作视野脱节
  const freeLimitReached = view.plan === 'free' && selected.size >= FREE_BLOCK_LIMIT
  const capacityInvalid = !Number.isInteger(dailyCapacity) || dailyCapacity < 1
  const blocksDirty = selected.size !== savedBlockIds.size
    || [...selected].some(id => !savedBlockIds.has(id))
  const formDirty = blocksDirty
    || readyByDate !== saved.readyByDate
    || dailyCapacity !== saved.dailyCapacity

  // 当前勾选集命中的岗位（勾选集恰为该岗位块集的名额内前缀）→ 按钮高亮，来回切换差异可见
  const activeTrackId = (() => {
    const limit = view.plan === 'free' ? FREE_BLOCK_LIMIT : Number.POSITIVE_INFINITY
    for (const t of view.tracks) {
      const prefix = t.blockIds.slice(0, limit)
      if (selected.size === prefix.length && prefix.every(id => selected.has(id))) return t.id
    }
    return null
  })()

  function toggle(blockId: string): void {
    setSaveStatus(null)
    setTrackPicked(null)   // 手动勾选后岗位配题反馈不再是当前事实
    setCramResult(null)   // 块集变更后旧的冲刺结果说明已过时
    setCramError(null)
    // 名额已满再点未勾块：拒绝（不勾上），提示条当场弹在被点的行后——任何点击必有回应
    if (view.plan === 'free' && !selected.has(blockId) && selected.size >= FREE_BLOCK_LIMIT) {
      setLastToggled(blockId)
      return
    }
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
    const willFull = view.plan === 'free' && (selected.has(blockId) ? selected.size - 1 : selected.size + 1) >= FREE_BLOCK_LIMIT
    setLastToggled(willFull ? blockId : null)
  }

  /** 按岗位换题：勾选集替换为该岗位的块（免费取前 2 个=名额内，付费全量）。
   *  替换而非合并——否则名额满后点按钮毫无变化，三个岗位来回点看不出区别（用户实测）。
   *  动作完成后在保存行明说「已按某岗位勾选 N 块」，把因果讲给用户 */
  function pickTrack(trackId: string, blockIds: readonly string[]): void {
    setSaveStatus(null)
    setCramResult(null)
    setCramError(null)
    setLastToggled(null)
    const limit = view.plan === 'free' ? FREE_BLOCK_LIMIT : Number.POSITIVE_INFINITY
    const picked = blockIds.slice(0, limit)
    setSelected(new Set(picked))
    const name = view.tracks.find(t => t.id === trackId)?.name ?? '岗位'
    setTrackPicked(
      view.plan === 'free' && blockIds.length > picked.length
        ? `已按「${name}」勾选 ${picked.length} 个块（免费名额内）；升级解锁全部 ${blockIds.length} 块`
        : `已按「${name}」勾选 ${picked.length} 个块`,
    )
  }

  async function save(): Promise<void> {
    // 请求前快照本次保存的变更面（pending 期间用户继续改不影响本次反馈与基线）
    const snapshot = {
      readyByDate, dailyCapacity,
      blocks: new Set(selected),
      dirty: { date: readyByDate !== saved.readyByDate, cap: dailyCapacity !== saved.dailyCapacity, blocks: blocksDirty },
    }
    setSaving(true)
    setSaveError(null)
    setSaveStatus(null)
    setTrackPicked(null)   // 保存后岗位配题反馈完成使命
    try {
      const { replanned, changed } = await client.postSettings({
        readyByDate: snapshot.readyByDate === '' ? null : (snapshot.readyByDate as SettingsView['readyByDate']),
        dailyCapacity: snapshot.dailyCapacity,
      })
      if (snapshot.dirty.blocks) {
        try {
          await client.postBlocks({ blockIds: [...snapshot.blocks] })
        } catch (e) {
          setSaveError(`设置已保存，但块集更新失败：${msgOf(e)}——可重试保存`)
          return
        }
      }
      setSavedBlockIds(new Set(snapshot.blocks))
      setSaved({ readyByDate: snapshot.readyByDate, dailyCapacity: snapshot.dailyCapacity })
      // 反馈按语义分流：changed（目标日期/容量实际变更）→ 重排三态；
      // 无排期变更但确有块集变更 → 「已保存，排期未重排」；啥都没改 → 「未变化」。
      const anyDirty = snapshot.dirty.date || snapshot.dirty.cap || snapshot.dirty.blocks
      setSaveStatus({
        kind: changed !== false ? 'plan' : anyDirty ? 'nav' : 'none',
        replanned,
      })
    } catch (e) {
      setSaveError(msgOf(e))
    } finally {
      setSaving(false)
    }
  }

  async function cram(): Promise<void> {
    setCramming(true)
    setCramError(null)
    setCramResult(null)
    try {
      const r = await client.postCram({ examDate: examDate as LocalDate, blockIds: [...savedBlockIds] })
      setCramResult(r)
      setSaveStatus(null)   // 加密已重铺计划，此前的保存反馈不再是最新事实
      if (r.readyByDate !== null) {
        setReadyByDate(r.readyByDate)   // 同步服务端写入的就绪日
        setSaved(prev => ({ ...prev, readyByDate: r.readyByDate as string }))   // 基线同知，不误报未保存
      }
    } catch (e) {
      setCramError(msgOf(e))
    } finally {
      setCramming(false)
    }
  }

  return (
    <div className="rise mx-auto max-w-2xl px-5 py-8">
      <h1 className="mb-8 font-serif text-3xl font-semibold tracking-tight text-paper-ink">设置</h1>

      <form
        onSubmit={e => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="mb-8">
          <p className="eyebrow mb-3 block">节奏</p>
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <label htmlFor="settings-capacity" className="mb-1.5 block text-xs tracking-[0.2em] text-paper-muted">
                每天刷几题
              </label>
              <input
                id="settings-capacity"
                type="number"
                min={1}
                value={dailyCapacity}
                onChange={e => {
                  setSaveStatus(null)
                  setDailyCapacity(Number(e.target.value))
                }}
                className="tnum w-28 rounded-md border border-paper-line bg-paper-card px-3 py-2 text-paper-ink transition-colors focus:border-paper-ink focus:outline-none"
              />
              {capacityInvalid && <p className="mt-1.5 text-sm text-mark-bad">须为 ≥1 的整数</p>}
            </div>
            <div>
              <label htmlFor="settings-ready-by" className="mb-1.5 block text-xs tracking-[0.2em] text-paper-muted">
                目标日期（可选）
              </label>
              <input
                id="settings-ready-by"
                type="date"
                min={today === '' ? undefined : today}
                value={readyByDate}
                onChange={e => {
                  setSaveStatus(null)
                  setReadyByDate(e.target.value)
                }}
                className="tnum rounded-md border border-paper-line bg-paper-card px-3 py-2 text-paper-ink transition-colors focus:border-paper-ink focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-paper-muted">填了就按考前峰值排计划；留空 = 日常滚动</p>
            </div>
          </div>
        </div>

        <fieldset>
          <legend className="eyebrow mb-3 block">
            块选择{view.plan === 'free' ? `（免费最多 ${FREE_BLOCK_LIMIT} 个）` : ''}
            <span className="tnum ml-2 normal-case tracking-normal" data-testid="selected-count">已勾 {selected.size} 个</span>
          </legend>
          {view.tracks.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-paper-muted">
                要面哪个岗位？点一下换成它的题{view.plan === 'free' ? '（免费取前 2 个）' : ''}：
              </span>
              {view.tracks.map(t => {
                const active = activeTrackId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => pickTrack(t.id, t.blockIds)}
                    className={`tnum rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      active
                        ? 'border-accent bg-accent/15 font-medium text-paper-ink'
                        : 'border-paper-line text-paper-ink hover:border-paper-muted'
                    }`}
                  >
                    {t.name}（{t.blockIds.length} 块）
                  </button>
                )
              })}
            </div>
          )}
          {(() => {
            // 按大类分组（对齐知识地图的分组视角），保持全量块的原始顺序。
            // 岗位在此页 = 「按岗位快速勾选」动作的素材（上方按钮），不是过滤也不是状态项
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
                    <Fragment key={b.blockId}>
                      <li className="group">
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
                      {/* 免费墙反馈：插在「刚勾满的那行」或「被拒绝点击的那行」后面——视线在哪，反馈就在哪 */}
                      {view.plan === 'free' && freeLimitReached && b.blockId === lastToggled && (
                        <li className="list-none">
                          <p role="status" data-testid="inline-cap-status"
                            className="mb-2 rounded-md border border-accent/60 bg-accent/10 px-4 py-2.5 text-sm text-paper-ink">
                            免费层最多选 {FREE_BLOCK_LIMIT} 个块——已选满，取消一个可更换；
                            <Link href="/upgrade" className="font-medium underline underline-offset-4 hover:opacity-80">升级后解锁全部块</Link>
                          </p>
                        </li>
                      )}
                    </Fragment>
                  ))}
                </ul>
              </section>
            ))
          })()}
        </fieldset>

        {/* 保存行：普通文档流（用户否决悬浮条），紧跟块列表——状态多行共存：
            错误 / 免费墙名额态 / 保存结果 / 未保存变更 / 已保存 */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1 space-y-0.5 text-sm">
            {saveError !== null && (
              <span role="alert" className="block text-mark-bad">{saveError}</span>
            )}
            {trackPicked !== null && (
              <span role="status" data-testid="track-picked" className="block">
                {trackPicked}
              </span>
            )}
            {(freeLimitReached || overLimit) && (
              <span role="status" data-testid="free-cap-status" className="block">
                免费层最多 {FREE_BLOCK_LIMIT} 个块——已选满，取消一个可更换；
                <Link href="/upgrade" className="font-medium underline underline-offset-4 hover:opacity-80">升级解锁全部</Link>
              </span>
            )}
            {saveStatus !== null && (
              <span data-testid="save-status" className="block text-mark-good">
                {saveStatus.kind === 'plan'
                  ? saveStatus.replanned > 0
                    ? `已重排 ${saveStatus.replanned} 张卡的计划`
                    : '日常滚动保持不变'
                  : saveStatus.kind === 'nav'
                    ? '已保存：块集已更新，排期未重排'
                    : '设置未变化，排期保持不变'}
              </span>
            )}
            {saveStatus === null && (formDirty
              ? <span data-testid="dirty-hint" className="block">有未保存的变更</span>
              : saveError === null && <span className="block text-paper-muted">已保存</span>)}
          </div>
          <button
            type="submit"
            disabled={overLimit || capacityInvalid || saving}
            className="btn-primary shrink-0"
          >
            {saving ? '保存中…' : '保存设置'}
          </button>
        </div>
      </form>

      <form onSubmit={e => { e.preventDefault(); void cram() }} className="card-flat mt-14 px-6 py-6">
        <fieldset>
          <legend className="eyebrow">面试冲刺</legend>
          <p className="mt-1 text-sm leading-relaxed text-paper-muted">
            约到面试了？已勾的 {savedBlockIds.size} 个块将重铺到考前，面试后自动恢复日常。
          </p>
          {blocksDirty && (
            <p className="mt-1.5 text-sm text-mark-bad">有未保存的勾选，先保存再开始冲刺</p>
          )}
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
                  setCramError(null)
                  setExamDate(e.target.value)
                }}
                className="tnum rounded-md border border-paper-line bg-paper px-3 py-2 text-paper-ink transition-colors focus:border-paper-ink focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={examDate === '' || savedBlockIds.size === 0 || blocksDirty || cramming}
              className="rounded-md bg-accent px-6 py-2 font-medium text-paper transition-all hover:opacity-90 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30"
            >
              {cramming ? '排期中…' : '开始冲刺'}
            </button>
          </div>
          {cramError !== null && <p role="alert" className="mt-3 text-sm text-mark-bad">{cramError}</p>}
          {cramResult !== null && (
            <p className="tnum mt-3 text-sm" data-testid="cram-result">
              已重铺 {cramResult.crammed} 张到考前
              {cramResult.excluded > 0 && `（${cramResult.excluded} 张来不及）`}
              {cramResult.overloaded && ' · 部分日子超量'}
              {cramResult.readyByDate !== null && ` · 目标日期 → ${cramResult.readyByDate}`}
            </p>
          )}
        </fieldset>
      </form>
    </div>
  )
}
