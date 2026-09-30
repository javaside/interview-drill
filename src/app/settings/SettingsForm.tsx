'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FREE_BLOCK_LIMIT } from '../../lib/entitlement/entitlement.js'
import { browserApi, type Api } from '../../client/api.js'
import type { SettingsView } from '../../server/settings.js'
import type { LocalDate } from '../../lib/scheduler/date.js'

/**
 * 设置屏（§5.5/§10.1，Task 11；历次重整至 2026-09-30 岗位自动保存版）——`'use client'`：
 * - **勾选集 = 每日排期的出题范围**（两档同语义）：免费 ≤2 兼免费墙；付费任意勾，
 *   勾多少排多少。未勾的块付费后仍可在知识地图自由刷——解锁承诺不靠默认全选兑现。
 * - **岗位 = 多选 chips，点了立即生效且自动保存（2026-09-30 用户拍板：整批动作
 *   不该让用户滚到底点保存；只有逐块手动勾题才需要手动保存）**：点一个岗位 chip =
 *   勾选集整批替换为该岗位的题目并落库；再点第二个 = 并集叠加；点掉一个 = 剩余并集；
 *   全部点掉 = 没勾任何题目（首页不出新题）。自动保存连点时排队串行、末次生效
 *   （autoSaveQueue）。免费取并集顺序前 2 并给升级出路；当前勾选集恰为某岗位块集时
 *   该 chip 预勾。全选按钮同为自动保存。
 * - **逐块手动勾选不自动保存**：出现「有未保存的变更」，由保存行手动提交。
 * - **节奏**：每天刷几题 + 目标日期（可选）并排一行，说明各一句话。
 * - **块选择**：列表按大类分组；免费名额勾满瞬间提示弹在刚勾行后、
 *   名额满点其他块不勾上且提示移到被点行后（点哪反馈跟哪）；保存行常驻名额态。
 * - **保存行**（文档流，紧跟块列表）：状态多行共存——错误 / 免费墙名额态 /
 *   保存结果（重排三态或「已保存，排期未重排」或「设置未变化」）/ 未保存变更 / 已保存。
 * - **面试冲刺**：独立 form（防 Enter 误触保存），作用已保存块集，成功后同步
 *   目标日期并更新基线，结果明示「目标日期 → X」副作用。
 * - **已保存基线**：saved（目标日期/容量）+ savedBlockIds（块集）双向快照，推导 formDirty。
 * - **错误链路**：errorResponse(400 {error}) → readJson 透传中文消息到 role=alert；
 *   两步请求（postSettings → postBlocks）第二步失败时明说「设置已保存，块集未更新」。
 * `api` 可选：server component 不传，client 侧默认 browserApi()。
 */

function msgOf(e: unknown): string {
  return e instanceof Error ? e.message : '请求失败，请重试'
}

/** 岗位/整批动作的页内反馈（文案口径：题目视角——勾了哪些题，首页就刷哪些题）：
 *  tracks=按岗位勾题（clamped=免费名额内截断；picked=0 即全部取消）、all=全选 */
type BulkNote =
  | { kind: 'tracks'; names: string[]; picked: number; total: number; cards: number; clamped: boolean }
  | { kind: 'all'; count: number; cards: number }

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
  const [bulkNote, setBulkNote] = useState<BulkNote | null>(null)   // 一键动作反馈；手动勾选/保存/新动作时清除或覆盖
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

  // 岗位高亮 = **从当前勾选集推导**（2026-09-30 定稿；localStorage 方案已废——它只在
  // 「点过之后」才有记录，存量选择刷新后依然丢高亮，用户「难道要重新选一遍？」）：
  // - 付费：岗位的块全部在勾选集里 → 高亮（多岗位并集、全选都正确回放，跨设备一致）；
  // - 免费：名额截断后勾选集只剩岗位前 2 块 → 「勾选集恰为该岗位名额内前缀」才算选中
  //   （并集截断后只有真正占到名额的岗位亮——诚实反映「你现在刷的是谁的题」）；
  // - 岗位的块被手动取消一块 → 该岗位不再高亮（高亮 = 完整勾着的岗位）。
  const knownIds = new Set(view.blocks.map(b => b.blockId))
  function trackIsOn(t: SettingsView['tracks'][number]): boolean {
    const ids = t.blockIds.filter(id => knownIds.has(id))
    if (ids.length === 0) return false
    if (view.plan === 'paid') return ids.every(id => selected.has(id))
    const prefix = ids.slice(0, FREE_BLOCK_LIMIT)
    return prefix.length === selected.size && prefix.every(id => selected.has(id))
  }
  const onTracks = view.tracks.filter(trackIsOn)
  const cardCountByBlock = new Map(view.blocks.map(b => [b.blockId, b.cardCount] as const))
  const cardsOf = (ids: readonly string[]): number =>
    ids.reduce((n, id) => n + (cardCountByBlock.get(id) ?? 0), 0)

  function toggle(blockId: string): void {
    setSaveStatus(null)
    setCramResult(null)   // 块集变更后旧的冲刺结果说明已过时
    setCramError(null)
    setBulkNote(null)   // 手动勾选后，一键动作的反馈不再代表当前事实
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

  /** 块集整批变更（岗位 chips / 全选）= **立即生效并自动保存**（2026-09-30 用户拍板：
   *  整批动作不该让用户滚到底点保存；只有逐块手动勾题才需要手动保存）。
   *  连点时若上一次自动保存在途 → 排队（autoSaveQueue），完成后以最新集落库（末次生效）。 */
  const autoSaveQueue = useRef<Set<string> | null>(null)

  function replaceSelectionAndSave(ids: string[], note: BulkNote): void {
    setSelected(new Set(ids))
    setSaveStatus(null)
    setCramResult(null)
    setCramError(null)
    const full = view.plan === 'free' && ids.length >= FREE_BLOCK_LIMIT
    setLastToggled(full ? ids[ids.length - 1] ?? null : null)
    const sel = new Set(ids)
    if (saving) autoSaveQueue.current = sel
    else void save(sel)
    setBulkNote(note)   // 在 save() 同步清空之后设置，保留整批动作的反馈
  }

  /** 点岗位 chip **立即生效**（chip 勾选态由勾选集推导，无独立状态）：
   *  - 点未亮的 = 勾选集整批替换为「已亮岗位 + 本岗位」块的并集——只点一个时，
   *    其他岗位的题当场全部取消；
   *  - 点已亮的 = 从并集里去掉它（剩余已亮岗位的并集）；全不亮 = 没勾任何题目。
   *  免费取并集顺序前 2，反馈给升级出路。 */
  function toggleTrack(trackId: string): void {
    const clicked = view.tracks.find(t => t.id === trackId)
    if (clicked === undefined) return
    const isOn = trackIsOn(clicked)
    const targets = isOn ? onTracks.filter(t => t.id !== trackId) : [...onTracks, clicked]
    // 并集按岗位列表顺序展开去重（确定序；免费截断取这个顺序的前 2）
    const union = [...new Set(targets.flatMap(t => t.blockIds))].filter(id => knownIds.has(id))
    const picked = view.plan === 'free' ? union.slice(0, FREE_BLOCK_LIMIT) : union
    replaceSelectionAndSave(picked, {
      kind: 'tracks', names: targets.map(t => t.name),
      picked: picked.length, total: union.length,
      cards: cardsOf(picked), clamped: picked.length < union.length,
    })
  }

  /** 全选（付费；免费名额 2 无整批意义，不提供。想全不勾 = 把岗位 chips 全部点掉即可） */
  function selectAll(): void {
    replaceSelectionAndSave(
      view.blocks.map(b => b.blockId),
      { kind: 'all', count: view.blocks.length, cards: cardsOf(view.blocks.map(b => b.blockId)) },
    )
  }

  /** 保存；sel 缺省 = 手动保存当前表单，整批自动保存传入显式块集（setState 异步读不到） */
  async function save(sel?: ReadonlySet<string>): Promise<void> {
    const blocks = sel ?? selected
    const selBlocksDirty = blocks.size !== savedBlockIds.size
      || [...blocks].some(id => !savedBlockIds.has(id))
    // 请求前快照本次保存的变更面（pending 期间用户继续改不影响本次反馈与基线）
    const snapshot = {
      readyByDate, dailyCapacity,
      blocks: new Set(blocks),
      dirty: { date: readyByDate !== saved.readyByDate, cap: dailyCapacity !== saved.dailyCapacity, blocks: selBlocksDirty },
    }
    setSaving(true)
    setSaveError(null)
    setSaveStatus(null)
    // 整批动作的反馈（已自动保存…）由自动保存路径自己管理，这里不清——排队的自动
    // 保存若清掉它，连点后反馈就消失；只有手动保存才需要清过时的整批反馈
    if (sel === undefined) setBulkNote(null)
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
      // 自动保存排队（整批动作连点）：上一次完成后立即以最新集落库——末次生效
      const queued = autoSaveQueue.current
      if (queued !== null) {
        autoSaveQueue.current = null
        void save(queued)
      }
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
          {view.plan === 'paid' && (
            <p className="mb-4 text-sm text-paper-muted">
              勾了的题目进首页每日排期；没勾的仍可在
              <Link href="/map" className="mx-1 underline underline-offset-4 transition-colors duration-150 ease-snap hover:text-paper-ink">知识地图</Link>
              自由刷
            </p>
          )}
          {view.tracks.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm text-paper-muted">
                点岗位 = 立刻勾上它的全部题目并自动保存，可多选叠加；也可在下面逐块勾（逐块勾选需手动保存）
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {view.tracks.map(t => (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-4 py-1.5 text-sm transition-colors duration-150 ease-snap ${
                      trackIsOn(t)
                        ? 'border-accent bg-accent/15 font-semibold text-accent'
                        : 'border-paper-line bg-paper text-paper-muted hover:border-paper-muted hover:text-paper-ink'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={trackIsOn(t)}
                      onChange={() => toggleTrack(t.id)}
                      className="size-3.5 accent-[var(--color-accent)]"
                    />
                    {t.name}（{t.blockIds.filter(id => knownIds.has(id)).length} 块）
                  </label>
                ))}
                {view.plan === 'paid' && (
                  <button
                    type="button"
                    onClick={selectAll}
                    className="rounded-lg border border-paper-line bg-paper px-4 py-1.5 text-sm text-paper-ink transition-colors duration-150 ease-snap hover:border-paper-muted"
                  >
                    全选（{view.blocks.length} 块）
                  </button>
                )}
              </div>
            </div>
          )}
          {bulkNote !== null && (
            <p role="status" data-testid="bulk-note"
              className="mb-4 rounded-md border border-paper-line bg-paper-card px-4 py-2.5 text-sm text-paper-ink">
              {bulkNote.kind === 'tracks' ? (
                bulkNote.clamped
                  ? <>已勾 {bulkNote.picked} 块 · {bulkNote.cards} 题（免费名额内，已自动保存）——<Link href="/upgrade" className="font-medium underline underline-offset-4 hover:opacity-80">升级解锁所选岗位全部 {bulkNote.total} 块</Link></>
                  : bulkNote.picked === 0
                    ? <>已取消全部岗位——没勾任何题目，已自动保存，首页不出新题</>
                    : <>已勾 {bulkNote.picked} 块 · {bulkNote.cards} 题（{bulkNote.names.join('、')}）——已自动保存，首页就刷这些</>
              ) : <>已勾全部 {bulkNote.count} 块 · {bulkNote.cards} 题——已自动保存，首页就刷这些</>}
            </p>
          )}
          {(() => {
            // 按大类分组（列表永远全量——岗位 chips 只是快速勾题手段，不过滤视野），保持原始顺序
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
