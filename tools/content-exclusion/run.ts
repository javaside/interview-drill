/**
 * LLM 调用（IO 层）。**不是「复用」**：仓库里唯一发请求的地方是
 * `src/server/qa.ts` 的 SSE 流，依赖 SqlRunner/用户/日配额 —— 那是给刷题页问答用的。
 *
 * 这里复用注册表（`PROVIDERS` / `selectProvider`）与家特有的 `extraBody`
 * （DeepSeek 的 `reasoning_effort: 'low'`），自建非流式请求层：
 * `stream: false` + 只取 `choices[0].message.content`（思考型模型的 reasoning 不进正文）。
 */
import { PROVIDERS, selectProvider } from '../../src/lib/ai/qa.js'
import type { QaProviderRuntime } from '../../src/lib/ai/qa.js'
import type { RawScorer } from './batch.js'

/**
 * 输出预算（含思考 tokens，两者共用这一份）。
 *
 * 实测（2026-10-04 标定）：deepseek-flash 即使 `reasoning_effort: 'low'` 也会思考，
 * 约 7 条候选的批就要 1301 输出 tokens（≈185/条），其中绝大部分是思考。取 4000 时
 * 已经出现「思考吃光额度、正文 0 字」的批次（finish_reason=length）。提到与问答同档的
 * 8000：**上限是天花板不是收费额，成本由真实生成量决定**，放宽只防截断。
 */
export const JUDGE_MAX_TOKENS = 8000

export function resolveProvider(env: Record<string, string | undefined>): QaProviderRuntime {
  const selection = selectProvider(env)
  if (selection.status !== 'ready') {
    throw new Error(`${selection.message}（可选：${PROVIDERS.map(p => p.apiKeyEnv).join(' / ')}）`)
  }
  return selection.provider
}

/** 一次调用的真实用量。设计文档 §11 的成本标定只认这个数，别用估算 */
export type LlmUsage = { promptTokens: number; completionTokens: number }

type ChatResponse = {
  choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown }
}

/** 非流式单轮请求 → 原始响应文本（解析与重试交给 batch.ts，便于用假 scorer 测） */
export function makeLlmScorer(
  provider: QaProviderRuntime,
  opts: { fetchImpl?: typeof fetch; maxTokens?: number; onUsage?: (u: LlmUsage) => void } = {},
): RawScorer {
  const doFetch = opts.fetchImpl ?? fetch
  return async prompt => {
    const res = await doFetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        max_tokens: opts.maxTokens ?? JUDGE_MAX_TOKENS,
        ...provider.extraBody,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`${provider.label} HTTP ${res.status}：${body.slice(0, 200)}`)
    }
    const json = (await res.json()) as ChatResponse
    const usage = json.usage
    if (opts.onUsage && usage) {
      opts.onUsage({
        promptTokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0,
        completionTokens: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0,
      })
    }
    const content = json.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.trim() === '') {
      // 最常见的成因不是「模型不理人」，而是**思考吃光了 max_tokens**：思考型模型
      // （DeepSeek）的 reasoning 与正文共用这份预算，批次一大思考就撑爆上限、正文 0 字。
      // 报清楚是上限问题，而不是让上层看到一句含糊的「没有 content」。
      const finish = json.choices?.[0]?.finish_reason
      if (finish === 'length') {
        throw new Error(
          `${provider.label} 的输出被 max_tokens=${opts.maxTokens ?? JUDGE_MAX_TOKENS} 截断：` +
          '思考 tokens 吃光了额度、正文为 0（调大上限，或把 MAX_BATCH 切小）',
        )
      }
      throw new Error(`${provider.label} 的响应里没有 choices[0].message.content（finish_reason=${String(finish)}）`)
    }
    return content
  }
}
