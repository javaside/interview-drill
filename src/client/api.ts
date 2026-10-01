import { withBase } from '../lib/base-path.js'
import type { Submission } from '../server/types.js'
import type { DailyPayload } from '../server/queue.js'
import type { ReviewResult } from '../server/review.js'
import type { SyncResult } from '../server/sync.js'
import type { LocalDate } from '../lib/scheduler/date.js'
import type { QaMessage } from '../lib/ai/qa.js'

/**
 * API 客户端接口（§8.3）：消费 4a 的五个端点。抽象成接口便于 sync-engine
 * 注入假实现单测——纯核不硬依赖 `fetch`。所有方法非 2xx / reject 抛错，
 * 供 `submitOne` 捕获转离线入队。
 */
export interface Api {
  /** GET /api/queue → 今日下发物 */
  fetchQueue(): Promise<DailyPayload>
  /** POST /api/review，body = submission → 权威判分与圆点序列 */
  postReview(s: Submission): Promise<ReviewResult>
  /** POST /api/sync，body = { submissions } → 批量回放结果 */
  postSync(subs: Submission[]): Promise<SyncResult>
  /** POST /api/settings → 因就绪日/容量变更重排的卡数 + 是否有实际变更（无变化跳过重排） */
  postSettings(body: { readyByDate?: LocalDate | null; dailyCapacity?: number }): Promise<{ replanned: number; changed: boolean }>
  /** POST /api/blocks → 暂停/新增的块数 */
  postBlocks(body: { blockIds: string[] }): Promise<{ paused: number; added: number }>
  /** POST /api/billing/create-order → 订单号 + 服务端定价 + 网关拉起支付参数 */
  postCreateOrder(): Promise<{ orderId: string; amountCents: number; payParams: unknown }>
  /** POST /api/billing/redeem → 邀请码兑换结果（fulfilled=刚解锁 / already=原本就已解锁） */
  postRedeem(code: string): Promise<{ outcome: 'fulfilled' | 'already' }>
  /** GET /api/backstage/invites → 邀请码台账（无明文，哈希前缀+备注+兑换者+状态） */
  fetchInviteCodes(): Promise<Array<{ id: string; hashPrefix: string; note: string | null; createdAt: string; usedByLogin: string | null; usedByGithubId: string | null; usedAt: string | null }>>
  /** POST /api/backstage/invites → 铸 n 张码，明文仅此一次返回 */
  postMintInvites(n: number, note: string): Promise<{ codes: string[] }>
  /** POST /api/cram → 面试临时加密（§5.8）：选中块重铺冲刺的结果 + 写入的新就绪日 */
  postCram(body: { examDate: LocalDate; blockIds: string[] }): Promise<{ crammed: number; excluded: number; overloaded: boolean; readyByDate: LocalDate | null }>
  /** POST /api/queue/requeue → 把今天刷过的卡拉回今天（misses=错题 / all=全部再来一遍） */
  postRequeue(scope?: 'misses' | 'all'): Promise<{ requeued: number }>
  /** POST /api/qa → 就单卡向 AI 提问（history 含本轮提问；上下文只含该卡，服务端不落库） */
  postQa(cardId: string, history: QaMessage[]): Promise<{ answer: string }>
}

const JSON_HEADERS = { 'content-type': 'application/json' } as const

/** 非 2xx：优先取服务端 { error } 中文消息；无 JSON body 时退回 HTTP 状态码 */
async function errorOf(res: Response): Promise<Error> {
  try {
    const body = (await res.json()) as { error?: unknown }
    if (typeof body.error === 'string' && body.error !== '') return new Error(body.error)
  } catch { /* body 非 JSON → 走状态码 */ }
  return new Error(`HTTP ${res.status}`)
}

/** 非 2xx 抛错（供 submitOne 转离线），2xx 解析 JSON 为 T */
async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw await errorOf(res)
  return (await res.json()) as T
}

/**
 * 浏览器/RSC-client 真实实现：走全局 `fetch`。JSON body + JSON 响应。
 */
export function browserApi(): Api {
  return {
    async fetchQueue() {
      return readJson<DailyPayload>(await fetch(withBase('/api/queue'), { method: 'GET' }))
    },
    async postReview(s) {
      return readJson<ReviewResult>(
        await fetch(withBase('/api/review'), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(s) }),
      )
    },
    async postSync(subs) {
      return readJson<SyncResult>(
        await fetch(withBase('/api/sync'), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ submissions: subs }) }),
      )
    },
    async postSettings(body) {
      return readJson<{ replanned: number; changed: boolean }>(
        await fetch(withBase('/api/settings'), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }),
      )
    },
    async postBlocks(body) {
      return readJson<{ paused: number; added: number }>(
        await fetch(withBase('/api/blocks'), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }),
      )
    },
    async postCreateOrder() {
      return readJson<{ orderId: string; amountCents: number; payParams: unknown }>(
        await fetch(withBase('/api/billing/create-order'), { method: 'POST', headers: JSON_HEADERS }),
      )
    },
    async postRedeem(code) {
      return readJson<{ outcome: 'fulfilled' | 'already' }>(
        await fetch(withBase('/api/billing/redeem'), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ code }) }),
      )
    },
    async fetchInviteCodes() {
      return readJson<Array<{ id: string; hashPrefix: string; note: string | null; createdAt: string; usedByLogin: string | null; usedByGithubId: string | null; usedAt: string | null }>>(
        await fetch(withBase('/api/backstage/invites'), { method: 'GET' }),
      )
    },
    async postMintInvites(n, note) {
      return readJson<{ codes: string[] }>(
        await fetch(withBase('/api/backstage/invites'), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ n, note }) }),
      )
    },
    async postCram(body) {
      return readJson<{ crammed: number; excluded: number; overloaded: boolean; readyByDate: LocalDate | null }>(
        await fetch(withBase('/api/cram'), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }),
      )
    },
    async postRequeue(scope: 'misses' | 'all' = 'misses') {
      return readJson<{ requeued: number }>(
        await fetch(withBase('/api/queue/requeue'), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ scope }) }),
      )
    },
    async postQa(cardId, history) {
      return readJson<{ answer: string }>(
        await fetch(withBase('/api/qa'), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ cardId, history }) }),
      )
    },
  }
}
