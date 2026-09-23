import type { Submission } from '../server/types.js'
import type { ReviewResult } from '../server/review.js'
import type { SyncResult } from '../server/sync.js'
import type { memoryStore } from './store.js'
import type { Api } from './api.js'

// Task 5/8 从 sync-engine.js 取用 newSubmission，故此处 re-export。
export { newSubmission } from './submission.js'
export type { SubmissionPayload } from './submission.js'

/**
 * 编排依赖（注入 IO）：`store` 提供离线队列/缓存，`api` 是 HTTP 客户端，
 * `online` 判在线（浏览器默认 `() => navigator.onLine`，测试注入常量）。
 */
export type SyncDeps = {
  store: ReturnType<typeof memoryStore>
  api: Api
  online: () => boolean
}

/** 在线默认判定：浏览器 navigator.onLine */
export const browserOnline = (): boolean => navigator.onLine

/**
 * 提交一张卡（§8.1 在线 / §8.3 离线）：
 * - 在线（`online()===true` 且 `postReview` 成功）→ 落库返回权威 `ReviewResult`。
 * - 离线（`online()===false`，或 `postReview` 抛错）→ 入队，返回 `{ online: false }`；
 *   UI 用本地 `scoreLocal` 出屏② 并标「计划将在联网后更新」。
 */
export async function submitOne(
  deps: SyncDeps,
  submission: Submission,
): Promise<{ online: boolean; result?: ReviewResult }> {
  if (deps.online()) {
    try {
      const result = await deps.api.postReview(submission)
      return { online: true, result }
    } catch {
      // 请求失败视同离线：入队待回放
    }
  }
  await deps.store.submissions.enqueue(submission)
  return { online: false }
}

/**
 * 回放离线队列（§8.3）：取队列全部 → `postSync` → 成功后移除已被服务端消化的项
 * （`results` 的 submissionId 与 `duplicated` 的并集——两者都已落库）→ 返回结果。
 * 空队列返回 null（无需请求）。
 */
export async function flushQueue(deps: SyncDeps): Promise<SyncResult | null> {
  const queued = await deps.store.submissions.all()
  if (queued.length === 0) return null

  const result = await deps.api.postSync(queued)
  const digested = new Set<string>(result.duplicated)
  for (const r of result.results) digested.add(r.submissionId)
  await deps.store.submissions.remove([...digested])

  return result
}
