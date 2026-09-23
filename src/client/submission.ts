import { ulid } from 'ulid'
import type { Submission } from '../server/types.js'

/** 分配式 Omit：对判别联合逐成员 Omit，保留判别字段（内建 Omit 会塌成裸 `{ kind }`） */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** 判别联合去掉公共字段（submissionId/cardId/reviewedAtMs）后的作答载荷部分 */
export type SubmissionPayload = DistributiveOmit<Submission, 'submissionId' | 'cardId' | 'reviewedAtMs'>

/**
 * 铸造一次提交（§8.3 幂等纪律）：客户端为每次作答生成一个 ULID 作 `submissionId`，
 * 入队与重试都带同一个——服务端 `review_log` 唯一索引据此去重。
 * `payload` 是判别联合的作答部分（如 `{ kind: 'selection', selected: [...] }`），
 * 拼上公共字段组成完整 `Submission`。
 */
export function newSubmission(
  cardId: string,
  reviewedAtMs: number,
  payload: SubmissionPayload,
): Submission {
  return { submissionId: ulid(), cardId, reviewedAtMs, ...payload }
}
