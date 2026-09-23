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

  return (
    <main className="mx-auto max-w-2xl">
      <div className="p-4 text-sm text-gray-500">
        <span data-testid="progress">{`${done}/${total}`}</span>
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
          <div className="mx-auto max-w-2xl p-4">
            <button
              type="button"
              onClick={advance}
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              {isLast ? '完成' : '下一题'}
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <section className="mx-auto max-w-2xl p-4 text-center">
          <p className="text-xl font-semibold">今日完成</p>
        </section>
      )}
    </main>
  )
}
