import type { Submission } from '../server/types.js'   // 仅类型，无运行时依赖
import type { DailyPayload } from '../server/queue.js'  // 仅类型，无运行时依赖

/** 入队原样存的提交（判别联合的别名——语义标注「已排队等待回放」） */
export type QueuedSubmission = Submission

/**
 * 离线提交队列抽象（§8.3）：断网时把提交入队，联网后由 sync-engine 逐条经 /api/sync 重放。
 * 幂等纪律——同 submissionId 入队多次只留一条（服务端 review_log 唯一索引兜底，客户端先去重减负）。
 */
export interface SubmissionStore {
  /** 入队；同 submissionId 视为同一次作答，重复入队幂等去重（不塞两条） */
  enqueue(s: Submission): Promise<void>
  /** 全取，按入队顺序返回（回放按序） */
  all(): Promise<Submission[]>
  /** 按 submissionId 批量移除（sync 成功后清理） */
  remove(ids: string[]): Promise<void>
}

/**
 * 下发物缓存抽象（§8.3）：缓存最近一次 /api/queue 的 DailyPayload，
 * 断网时用它渲染屏①/屏②（本地判分 + 圆点），单槽（只存「今日」一份）。
 */
export interface PayloadCache {
  save(p: DailyPayload): Promise<void>
  load(): Promise<DailyPayload | null>
}

/**
 * 内存实现（测试用 + 纯核，可 node 单测）：零 idb/DOM 依赖。
 * - submissions：Map keyed by submissionId——天然按主键去重；Map 迭代序 = 首次插入序，
 *   故 all() 保持插入顺序（同 id 二次入队覆盖值但不改位置，仍一条）。
 * - cache：单变量，save 覆盖，load 未存返回 null。
 */
export function memoryStore(): { submissions: SubmissionStore; cache: PayloadCache } {
  const queue = new Map<string, Submission>()
  let cached: DailyPayload | null = null

  const submissions: SubmissionStore = {
    async enqueue(s) {
      queue.set(s.submissionId, s)
    },
    async all() {
      return [...queue.values()]
    },
    async remove(ids) {
      for (const id of ids) queue.delete(id)
    },
  }

  const cache: PayloadCache = {
    async save(p) {
      cached = p
    },
    async load() {
      return cached
    },
  }

  return { submissions, cache }
}
