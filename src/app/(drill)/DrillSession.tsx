'use client'

import { useEffect, useMemo, useState } from 'react'
import { DrillQuestion } from './DrillQuestion.js'
import type { SubmissionPayload } from './DrillQuestion.js'
import { DrillFeedback } from './DrillFeedback.js'
import { newSubmission, submitOne } from '../../client/sync-engine.js'
import { scoreLocal } from '../../client/scoring.js'
import { browserApi } from '../../client/api.js'
import { idbStore } from '../../client/idb-store.js'
import type { memoryStore } from '../../client/store.js'
import type { Api } from '../../client/api.js'
import type { DailyPayload } from '../../server/queue.js'
import type { Submission } from '../../server/types.js'
import type { ReviewResult } from '../../server/review.js'

/**
 * 主循环编排依赖（注入 IO，RSC 边界纪律）：含函数与 idb 句柄不可序列化，
 * 故 server component 绝不传入——省略时浏览器侧自建，测试才显式注入。
 */
export type DrillDeps = {
  store: ReturnType<typeof memoryStore>
  api: Api
  online: () => boolean
  now: () => number
  /** 再练错题（v2）：注入优先于 api（测试用）；生产走 browserApi().postRequeue */
  postRequeue?: () => Promise<{ requeued: number }>
  /** 全部再来一遍（v2）：同上，scope='all' */
  postRequeueAll?: () => Promise<{ requeued: number }>
}

export type DrillSessionProps = {
  payload: DailyPayload
  deps?: DrillDeps
}

type Phase = 'question' | 'feedback' | 'done'

/**
 * 刷题主循环容器（§6/§8.3）：串起屏①（DrillQuestion）→ 提交（submitOne）→
 * 屏②（DrillFeedback）→「下一题/完成」推进 → 队列走完显示完成态。进度 done/total。
 *
 * 离线纪律：断网时 submitOne 入队（不调 postReview），屏② 用 scoreLocal 本地判分出反馈，
 * 标「计划将在联网后更新」；客户端永不生成计划（remainingPlan 取缓存或空、replanned=false）。
 * 进度分母 total 来自服务端 payload.progress.total，当天不变（不客户端自增分母）。
 */
export function DrillSession({ payload, deps: depsProp }: DrillSessionProps) {
  // deps 可选：省略时浏览器侧自建（idb + 真实 fetch），测试显式注入 memoryStore + 假 api。
  const defaultDeps = useMemo<DrillDeps>(
    () => ({
      store: idbStore(),
      api: browserApi(),
      online: () => navigator.onLine,
      now: () => Date.now(),
    }),
    [],
  )
  const deps = depsProp ?? defaultDeps

  const total = payload.progress.total
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(payload.progress.done)
  const [phase, setPhase] = useState<Phase>(payload.queue.length === 0 ? 'done' : 'question')
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [offline, setOffline] = useState(false)

  // 首次挂载把下发物写入缓存，供离线复用。
  useEffect(() => {
    void deps.store.cache.save(payload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const card = payload.cards[index]
  const variant = payload.prepared[index]?.variants[0]
  const isLast = index === payload.queue.length - 1

  const handleSubmit = async (answer: SubmissionPayload) => {
    if (card === undefined || variant === undefined) return
    const sub = newSubmission(card.cardId, deps.now(), answer)
    const r = await submitOne(
      { store: deps.store, api: deps.api, online: deps.online },
      sub,
    )
    setSubmission(sub)
    if (r.online && r.result !== undefined) {
      setResult(r.result)
      setOffline(false)
    } else {
      // 离线：本地判分拼一个 ReviewResult（不落库，仅屏② 即时反馈）。
      const local = scoreLocal(card, variant, sub)
      const localResult: ReviewResult = {
        score: local.score,
        newS: local.score, // 占位：屏② 不读，权威 newS 由服务端回放时计算
        nextReviewDate: null,
        remainingReviews: 0,
        remainingPlan: [], // 客户端永不生成计划；缓存无该卡剩余计划则空
        replanned: false,
        maintenanceAdvanced: false,
        feedback: {
          correctChecked: local.correctChecked,
          wrongChecked: local.wrongChecked,
          missed: local.missed,
        },
      }
      setResult(localResult)
      setOffline(true)
    }
    setPhase('feedback')
  }

  const advance = () => {
    setDone(d => d + 1)
    if (isLast) {
      setPhase('done')
    } else {
      setIndex(i => i + 1)
      setResult(null)
      setSubmission(null)
      setOffline(false)
      setPhase('question')
    }
  }

  /** 再练错题（v2）：用户主动把今天答错过的卡拉回今天——初学阶段的密集重练权 */
  const requeueMisses = async () => {
    await (deps.postRequeue ?? deps.api.postRequeue)()
    window.location.reload()
  }

  /** 全部再来一遍（v2）：今天刷过的卡全部拉回——刷过一次 ≠ 记住，重复到记住为止 */
  const requeueAll = async () => {
    await (deps.postRequeueAll ?? deps.api.postRequeue)('all')
    window.location.reload()
  }

  return (
    <main className="rise mx-auto max-w-2xl px-5 pb-16">
      <div className="sticky top-[72px] z-30 -mx-5 mb-4 rounded-2xl border border-white/[0.06] bg-paper/80 px-5 py-3 backdrop-blur-2xl">
        <div className="flex items-center justify-between text-sm text-paper-muted">
          <span>今日进度</span>
          <div className="flex items-center gap-4">
            {payload.missesToday > 0 && phase !== 'done' && (
              <button
                type="button"
                onClick={requeueMisses}
                className="tnum rounded-full border border-accent px-3 py-0.5 text-xs text-accent transition-colors hover:bg-accent-soft"
              >
                错题 {payload.missesToday}
              </button>
            )}
            <span data-testid="progress" className="tnum font-medium text-paper-ink">{`${done}/${total}`}</span>
          </div>
        </div>
        {total > 0 && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-paper-wash" aria-hidden="true">
            <div
              className="h-1 rounded-full bg-paper-ink transition-all duration-500 ease-out"
              style={{ width: `${total === 0 ? 0 : Math.round((done / total) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {phase === 'question' && card !== undefined && variant !== undefined && (
        <DrillQuestion key={card.cardId} card={card} variant={variant} onSubmit={handleSubmit} />
      )}

      {phase === 'feedback' && card !== undefined && variant !== undefined && result !== null && submission !== null && (
        <div>
          <DrillFeedback
            card={card}
            variant={variant}
            submission={submission}
            result={result}
            offline={offline}
          />
          <div className="mx-auto max-w-2xl px-5">
            <button
              type="button"
              onClick={advance}
              className="btn-primary px-8"
            >
              {isLast ? '完成' : '下一题'}
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && done === 0 && total === 0 && payload.mode === 'maintenance' && (
        <section className="shell mt-8"><div className="core px-6 py-14 text-center" data-shell-close="1">
          <h2 className="font-serif text-xl font-semibold text-paper-ink">常备模式 · 今天没有到期卡</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-paper-muted">
            滚动间隔复习会按到期日把卡送回队列——答对的间隔越拉越长，答错的明天就来。
          </p>
          {payload.needsDateUpdate && (
            <p className="mt-3 text-sm text-mark-miss" data-testid="needs-date-update">
              就绪日已过，已回到常备模式。约到面试可在设置里临时加密。
            </p>
          )}
          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            {payload.missesToday > 0 && (
              <button
                type="button"
                onClick={requeueMisses}
                className="rounded-md bg-accent px-5 py-2 font-medium text-paper shadow-stamp transition-all duration-200 hover:-translate-y-px hover:opacity-95 active:translate-y-0"
              >
                再练今天的 {payload.missesToday} 张错题
              </button>
            )}
            <a href="/map" className="text-paper-muted underline underline-offset-4 transition-colors hover:text-paper-ink">
              看看知识地图
            </a>
          </div>
        </div></section>
      )}

      {phase === 'done' && done === 0 && total === 0 && payload.mode !== 'maintenance' && (
        <section className="shell mt-8"><div className="core px-6 py-14 text-center" data-shell-close="1">
          <h2 className="font-serif text-xl font-semibold text-paper-ink">今日队列是空的</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-paper-muted">
            排期由就绪日与所选知识块决定。设定你的面试日期、勾选要刷的块，队列就会出现。
          </p>
          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            <a
              href="/settings"
              className="rounded-md bg-paper-ink px-5 py-2 font-medium text-paper transition-all hover:opacity-90 active:translate-y-px"
            >
              设定就绪日与知识块
            </a>
            {payload.missesToday > 0 && (
              <button
                type="button"
                onClick={requeueMisses}
                className="rounded-md bg-accent px-5 py-2 font-medium text-paper shadow-stamp transition-all duration-200 hover:-translate-y-px hover:opacity-95 active:translate-y-0"
              >
                再练今天的 {payload.missesToday} 张错题
              </button>
            )}
            <a href="/map" className="text-paper-muted underline underline-offset-4 transition-colors hover:text-paper-ink">
              看看知识地图
            </a>
          </div>
        </div></section>
      )}

      {phase === 'done' && (done > 0 || total > 0) && (
        <section className="shell mt-8"><div className="core px-6 py-14 text-center" data-shell-close="1">
          <p className="font-serif text-xl font-semibold text-paper-ink">今日完成</p>
          {total > 0 ? (
            <p className="tnum mt-2 text-sm text-paper-muted">{`${done}/${total} · 明天见`}</p>
          ) : (
            // 分母被当天首次访问锁定为 0（先访问后设置的场景）：只报今天刷过的题数
            <p className="tnum mt-2 text-sm text-paper-muted">{`今天刷了 ${done} 题`}</p>
          )}
          {payload.missesToday > 0 && (
            <button
              type="button"
              onClick={requeueMisses}
              className="mt-5 rounded-md bg-accent px-6 py-2 text-sm font-medium text-paper transition-all hover:opacity-90 active:translate-y-px"
            >
              没记住？再练今天的 {payload.missesToday} 张错题
            </button>
          )}
          {(done > 0 || payload.missesToday > 0) && (
            <div className="mt-3">
              <button
                type="button"
                onClick={requeueAll}
                className="rounded-md border border-paper-line px-6 py-2 text-sm text-paper-muted transition-colors hover:border-paper-ink hover:text-paper-ink"
              >
                全部再来一遍（{Math.max(done, payload.missesToday)} 张）
              </button>
            </div>
          )}
        </div></section>
      )}
    </main>
  )
}
