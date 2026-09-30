'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { FREE_BLOCK_LIMIT } from '../../lib/entitlement/entitlement.js'
import { browserApi, type Api } from '../../client/api.js'
import type { SettingsView } from '../../server/settings.js'
import type { LocalDate } from '../../lib/scheduler/date.js'

/**
 * 设置屏（§5.5/§10.1，Task 11；交互重整 2026-09-28；反馈语义重整 2026-09-30）——`'use client'`：
 * - **两个独立 form**：设置区（岗位/就绪日/容量/块集/保存）与临时加密区。
 *   此前整页一个 form，加密日期框按 Enter 会误触「保存设置」全局重排。
 * - **已保存基线**：saved（就绪日/容量/岗位）+ savedBlockIds（块集）双向快照，
 *   推导 formDirty 常驻提示「有未保存的变更」——此前改没改、存没存全程无反馈。
 *   保存成功 / cram 写入就绪日后同步基线，提示自动消失且不误报。
 * - **保存反馈按语义分流**：服务端 changed=true（就绪日/容量实际变更）→ 重排三态；
 *   changed=false 但确有块集/岗位变更 → 「已保存，排期未重排」——此前一律显示
 *   「设置未变化」，用户明明改了块集却说没变（把「排期未变」错说成「设置未变」）。
 * - **cram 作用已保存块集**（savedBlockIds）：勾选有未保存变更时加密禁用并提示先保存；
 *   成功后用返回的 readyByDate 同步表单**并更新基线**，结果明示「就绪日 → X」副作用。
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
  const [trackId, setTrackId] = useState<string>(view.trackId ?? '')
  // 已保存基线：与表单 state 对比得「未保存变更」；保存/cram 成功后同步
  const [saved, setSaved] = useState<{ readyByDate: string; dailyCapacity: number; trackId: string }>(
    () => ({ readyByDate: view.readyByDate ?? '', dailyCapacity: view.dailyCapacity, trackId: view.trackId ?? '' }),
  )
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(view.blocks.filter(b => b.selected).map(b => b.blockId)),
  )
  const [savedBlockIds, setSavedBlockIds] = useState<Set<string>>(
    () => new Set(view.blocks.filter(b => b.selected).map(b => b.blockId)),
  )
  const [lastToggled, setLastToggled] = useState<string | null>(null)   // 勾满提示插在其行后（视线焦点处）
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
    || trackId !== saved.trackId

  const track = view.tracks.find(t => t.id === trackId)
  const trackSet = new Set(track?.blockIds ?? [])

  function toggle(blockId: string): void {
    setSaveStatus(null)
    setCramResult(null)   // 块集变更后旧的加密结果说明已过时
    setCramError(null)
    setLastToggled(blockId)
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
  }

  async function save(): Promise<void> {
    // 请求前快照本次保存的变更面（pending 期间用户继续改不影响本次反馈与基线）
    const snapshot = {
      readyByDate, dailyCapacity, trackId,
      blocks: new Set(selected),
      dirty: { date: readyByDate !== saved.readyByDate, cap: dailyCapacity !== saved.dailyCapacity, track: trackId !== saved.trackId, blocks: blocksDirty },
    }
    setSaving(true)
    setSaveError(null)
    setSaveStatus(null)
    try {
      const { replanned, changed } = await client.postSettings({
        readyByDate: snapshot.readyByDate === '' ? null : (snapshot.readyByDate as SettingsView['readyByDate']),
        dailyCapacity: snapshot.dailyCapacity,
        trackId: snapshot.trackId === '' ? null : snapshot.trackId,
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
      setSaved({ readyByDate: snapshot.readyByDate, dailyCapacity: snapshot.dailyCapacity, trackId: snapshot.trackId })
      // 反馈按语义分流：changed（就绪日/容量实际变更）→ 重排三态；
      // 无排期变更但确有块集/岗位变更 → 「已保存，排期未重排」；啥都没改 → 「未变化」。
      const anyDirty = snapshot.dirty.date || snapshot.dirty.cap || snapshot.dirty.track || snapshot.dirty.blocks
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
            冲刺截止日（就绪日）
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
          <p className="mt-1.5 text-xs text-paper-muted">
            留空 = 常备模式：滚动间隔复习，随时保持题感；填写后保存，全局排期按该日记忆峰值冲刺（改动会重排全部活跃卡的计划）；早于今天的日期按常备处理
          </p>
        </div>

        <div className="mb-8">
          <label htmlFor="settings-capacity" className="mb-1.5 block text-xs tracking-[0.2em] text-paper-muted">
            每日容量（题）
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
          <p className="mt-1.5 text-xs text-paper-muted">排期按此容量把冲刺计划摊到每天（≥1 的整数）</p>
          {capacityInvalid && <p className="mt-1.5 text-sm text-mark-bad">容量须为 ≥1 的整数</p>}
        </div>

        <fieldset>
          <legend className="eyebrow mb-3 block">
            块选择{view.plan === 'free' ? `（免费最多 ${FREE_BLOCK_LIMIT} 个）` : ''}
            <span className="tnum ml-2 normal-case tracking-normal" data-testid="selected-count">已勾 {selected.size} 个</span>
          </legend>
          {view.plan === 'free' && freeLimitReached && (
            // sticky：勾满后这条随滚动贴住视口顶，无论用户在列表何处操作都看得见
            <p role="status" data-testid="free-cap-status"
              className="sticky top-2 z-10 mb-3 rounded-md border border-accent/60 bg-accent/10 px-4 py-2.5 text-sm text-paper-ink">
              免费层最多选 {FREE_BLOCK_LIMIT} 个块——已选满，取消一个可更换；
              <Link href="/upgrade" className="font-medium underline underline-offset-4 hover:opacity-80">升级后解锁全部块</Link>
            </p>
          )}
          {overLimit ? (
            <p role="alert" className="mb-3 text-sm text-mark-bad">
              免费层最多选 {FREE_BLOCK_LIMIT} 个块——
              <Link href="/upgrade" className="underline underline-offset-4 hover:opacity-80">升级后解锁全部块</Link>
            </p>
          ) : null}
          {track !== undefined && (
            <p className="mb-3 text-xs text-paper-muted">
              标「推荐」的是 {track.name} 岗位包含的块；勾选 = 要刷的块
            </p>
          )}
          {(() => {
            // 按大类分组（对齐知识地图的分组视角），保持全量块的原始顺序——
            // 不做视野过滤：此前「只看岗位内块/推荐-全部切换」把内部概念泄漏给用户，
            // 还制造「视野外已选块」的解释负担；岗位推荐靠徽标标注即可
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
                            disabled={freeLimitReached && !selected.has(b.blockId)}
                            title={freeLimitReached && !selected.has(b.blockId)
                              ? `免费层最多 ${FREE_BLOCK_LIMIT} 个块，先取消一个再更换`
                              : undefined}
                            onChange={() => toggle(b.blockId)}
                          />
                          <span className="flex-1">
                            {b.blockName}
                            {/* 岗位推荐徽标：岗位包内的块常标——列表全量展示，勾哪刷哪，
                                推荐只是标注不是过滤（此前荧光下划线/视野切换均已被证 confusing） */}
                            {trackSet.has(b.blockId) && (
                              <span
                                className="ml-2 inline-block rounded border border-accent/60 px-1.5 py-px align-middle text-xs text-paper-muted"
                                title={`${track?.name ?? ''}岗位包含此块`}
                              >推荐</span>
                            )}
                          </span>
                          <span className="tnum shrink-0 text-sm text-paper-muted">{b.cardCount} 题</span>
                        </label>
                      </li>
                      {/* 勾满瞬间的跟随提示：插在刚勾的那行后面——用户视线在哪，反馈就在哪。
                          此前提示只挂块区顶部，勾列表中部时根本不在视野内（用户实测反馈） */}
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

        {formDirty && !saving && (
          <p className="mt-4 text-sm text-paper-muted" data-testid="dirty-hint">有未保存的变更</p>
        )}

        <button
          type="submit"
          disabled={overLimit || capacityInvalid || saving}
          className="btn-primary mt-8 w-full sm:w-auto"
        >
          {saving ? '保存中…' : '保存设置'}
        </button>

        {saveError !== null && <p role="alert" className="mt-4 text-sm text-mark-bad">{saveError}</p>}

        {saveStatus !== null && (
          <p className="mt-4 text-sm text-mark-good" data-testid="save-status">
            {saveStatus.kind === 'plan'
              ? saveStatus.replanned > 0
                ? `已重排 ${saveStatus.replanned} 张卡的计划`
                : '常备模式：滚动计划保持不变'
              : saveStatus.kind === 'nav'
                ? '已保存：块集/岗位已更新，排期未重排'
                : '设置未变化，排期保持不变'}
          </p>
        )}
      </form>

      <form onSubmit={e => { e.preventDefault(); void cram() }} className="card-flat mt-14 px-6 py-6">
        <fieldset>
          <legend className="eyebrow">临时加密</legend>
          <p className="mt-1 text-sm leading-relaxed text-paper-muted">
            约到面试了？只对已保存的 {savedBlockIds.size} 个块在面试前重铺冲刺，其他块排期不动；
            就绪日将自动设为面试前一天，面试过后自动回常备。
          </p>
          {blocksDirty && (
            <p className="mt-1.5 text-sm text-mark-bad">有未保存的块变更，先保存设置再加密</p>
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
              {cramming ? '加密中…' : '临时加密'}
            </button>
          </div>
          {cramError !== null && <p role="alert" className="mt-3 text-sm text-mark-bad">{cramError}</p>}
          {cramResult !== null && (
            <p className="tnum mt-3 text-sm" data-testid="cram-result">
              已加密 {cramResult.crammed} 张
              {cramResult.excluded > 0 && `（${cramResult.excluded} 张窗口不足）`}
              {cramResult.overloaded && ' · 部分日子超容量'}
              {cramResult.readyByDate !== null && ` · 就绪日 → ${cramResult.readyByDate}`}
            </p>
          )}
        </fieldset>
      </form>
    </div>
  )
}
