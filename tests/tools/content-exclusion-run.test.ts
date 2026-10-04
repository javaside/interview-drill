import { JUDGE_MAX_TOKENS, makeLlmScorer, resolveProvider } from '../../tools/content-exclusion/run.js'
import { PROVIDERS } from '../../src/lib/ai/qa.js'

/**
 * 请求层（IO）用注入的 fetch 测：不发真请求。
 * 重点是三件事 —— 家特有的 extraBody 有没有带上（DeepSeek 的 reasoning_effort）、
 * `stream: false`、以及**只取 choices[0].message.content**（思考型模型的 reasoning
 * 不进正文，混进来会把 JSON 解析带偏）。
 */

const provider = {
  id: 'deepseek', label: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com', apiKey: 'sk-test', model: 'deepseek-flash',
  maxTokens: 8000, extraBody: { reasoning_effort: 'low' as const },
}

function fetchStub(reply: unknown, opts: { status?: number } = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! })
    return {
      ok: (opts.status ?? 200) < 400,
      status: opts.status ?? 200,
      json: async () => reply,
      text: async () => JSON.stringify(reply),
    } as unknown as Response
  }) as typeof fetch
  return { impl, calls }
}

test('请求打到 /chat/completions，带 Bearer 与流式关闭标记，并入家特有 extraBody', async () => {
  const { impl, calls } = fetchStub({ choices: [{ message: { content: '[1]' } }] })
  const score = makeLlmScorer(provider, { fetchImpl: impl })
  expect(await score('PROMPT')).toBe('[1]')

  const call = calls[0]!
  expect(call.url).toBe('https://api.deepseek.com/chat/completions')
  expect((call.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
  const body = JSON.parse(String(call.init.body))
  expect(body).toMatchObject({
    model: 'deepseek-flash',
    stream: false,
    max_tokens: JUDGE_MAX_TOKENS,
    reasoning_effort: 'low',                        // 家特有参数不能被吞掉
  })
  expect(body.messages).toEqual([{ role: 'user', content: 'PROMPT' }])
})

test('只取正文：思考内容（reasoning）不进返回值', async () => {
  const { impl } = fetchStub({
    choices: [{ message: { reasoning: '我先想想……', content: '[2, 5]' } }],
  })
  expect(await makeLlmScorer(provider, { fetchImpl: impl })('P')).toBe('[2, 5]')
})

test('非 2xx 与缺正文都抛中文可读的错误（交给 batch 重试 → fail-closed）', async () => {
  const bad = fetchStub({ error: 'invalid key' }, { status: 401 })
  await expect(makeLlmScorer(provider, { fetchImpl: bad.impl })('P')).rejects.toThrow(/DeepSeek HTTP 401/)

  const empty = fetchStub({ choices: [{ message: {} }] })
  await expect(makeLlmScorer(provider, { fetchImpl: empty.impl })('P')).rejects.toThrow(/没有 choices\[0\].message.content/)
})

test('resolveProvider：没配 key 时给中文提示并列出可配的变量名', () => {
  expect(() => resolveProvider({})).toThrow(/还没有配置/)
  expect(() => resolveProvider({ AI_PROVIDER: 'nosuch', DEEPSEEK_API_KEY: 'sk-x' })).toThrow(/不认识/)
  const ok = resolveProvider({ DEEPSEEK_API_KEY: 'sk-x' })
  expect(ok.id).toBe('deepseek')
  expect(ok.model).toBe(PROVIDERS.find(p => p.id === 'deepseek')!.defaultModel)
})
