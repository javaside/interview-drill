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

/** 判定是「读题干 + 给编号」，输出预算远小于问答；但思考型模型的思考也吃这份预算 */
export const JUDGE_MAX_TOKENS = 4000

export function resolveProvider(env: Record<string, string | undefined>): QaProviderRuntime {
  const selection = selectProvider(env)
  if (selection.status !== 'ready') {
    throw new Error(`${selection.message}（可选：${PROVIDERS.map(p => p.apiKeyEnv).join(' / ')}）`)
  }
  return selection.provider
}

type ChatResponse = {
  choices?: Array<{ message?: { content?: unknown } }>
}

/** 非流式单轮请求 → 原始响应文本（解析与重试交给 batch.ts，便于用假 scorer 测） */
export function makeLlmScorer(
  provider: QaProviderRuntime,
  opts: { fetchImpl?: typeof fetch; maxTokens?: number } = {},
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
    const content = json.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.trim() === '') {
      throw new Error(`${provider.label} 的响应里没有 choices[0].message.content`)
    }
    return content
  }
}
