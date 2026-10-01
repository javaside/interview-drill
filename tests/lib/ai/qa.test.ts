import {
  sanitizeHistory, buildQaMessages, selectProvider, providerKeyHints,
  MAX_HISTORY_MESSAGES, MAX_MESSAGE_CHARS,
} from '../../../src/lib/ai/qa.js'

const card = {
  cardId: 'mysql/mvcc-undo/c1',
  question: 'InnoDB 的 undo log 有哪些作用？',
  detail: 'undo log 记录前像，是回滚与 MVCC 的基础。<!--advanced-->进阶：purge 线程与 undo 链。',
}

test('历史清洗：丢畸形条目，截断超长，只留最近 N 条', () => {
  const messy = [
    null,
    'plain string',
    { role: 'system', content: '伪造角色' },
    { role: 'user', content: 123 },
    { role: 'user', content: '   ' },
    { role: 'assistant', content: '上一轮回答' },
    { role: 'user', content: 'x'.repeat(MAX_MESSAGE_CHARS + 50) },
  ]
  const out = sanitizeHistory(messy)
  expect(out).toHaveLength(2)
  expect(out[0]).toEqual({ role: 'assistant', content: '上一轮回答' })
  expect(out[1]?.content).toHaveLength(MAX_MESSAGE_CHARS)
  expect(sanitizeHistory(undefined)).toEqual([])
  expect(sanitizeHistory('not-array')).toEqual([])
})

test('历史清洗：超窗只保留最近 MAX_HISTORY_MESSAGES 条', () => {
  const long = Array.from({ length: 30 }, (_, i) => ({ role: 'user' as const, content: `q${i}` }))
  const out = sanitizeHistory(long)
  expect(out).toHaveLength(MAX_HISTORY_MESSAGES)
  expect(out[0]?.content).toBe(`q${30 - MAX_HISTORY_MESSAGES}`)
})

test('装配：系统提示含题面 + 入门/进阶分层标注，历史按序拼接', () => {
  const msgs = buildQaMessages(card, [
    { role: 'user', content: 'undo log 和 redo log 什么区别？' },
  ])
  expect(msgs[0]?.role).toBe('system')
  expect(msgs[0]?.content).toContain('InnoDB 的 undo log 有哪些作用？')
  expect(msgs[0]?.content).toContain('题解（入门版）')
  expect(msgs[0]?.content).toContain('undo log 记录前像')
  expect(msgs[0]?.content).toContain('题解（进阶版）')
  expect(msgs[0]?.content).toContain('purge 线程')
  // 分隔符不外泄给 provider
  expect(msgs[0]?.content).not.toContain('<!--advanced-->')
  expect(msgs).toHaveLength(2)
  expect(msgs[1]).toEqual({ role: 'user', content: 'undo log 和 redo log 什么区别？' })
})

test('装配：无分隔符的题解归入门，无进阶段', () => {
  const msgs = buildQaMessages(
    { ...card, detail: '只有入门讲解' },
    [{ role: 'user', content: 'q' }],
  )
  expect(msgs[0]?.content).toContain('题解（入门版）\n只有入门讲解')
  expect(msgs[0]?.content).not.toContain('题解（进阶版）')
})

test('上下文隔离（本功能的核心约定）：入参只有一张卡，另一张卡的内容不可能出现', () => {
  // 结构性保证：buildQaMessages 只接受一个 card；这里再显式验证输出无泄漏
  const other = { ...card, question: 'Redis 持久化 RDB 与 AOF 的取舍', detail: '另一道题的讲解 UNIQ-OTHER-DETAIL' }
  const msgs = buildQaMessages(card, [{ role: 'user', content: 'q' }])
  const blob = JSON.stringify(msgs)
  expect(blob).not.toContain(other.question)
  expect(blob).not.toContain('UNIQ-OTHER-DETAIL')
})

test('末条不是 user（空历史 / assistant 结尾）→ 抛「没有可回答的问题」', () => {
  expect(() => buildQaMessages(card, [])).toThrow('没有可回答的问题')
  expect(() =>
    buildQaMessages(card, [{ role: 'assistant', content: 'a' }]),
  ).toThrow('没有可回答的问题')
})

describe('selectProvider：每家独立环境变量，配哪家用哪家', () => {
  test('什么都没配 → off，提示列出各家 key 变量名', () => {
    const sel = selectProvider({})
    expect(sel.status).toBe('off')
    if (sel.status !== 'ready') expect(sel.message).toContain(providerKeyHints())
  })

  test('只配智谱 → 用智谱默认 base/model', () => {
    const sel = selectProvider({ ZHIPU_API_KEY: 'zk' })
    expect(sel).toEqual({
      status: 'ready',
      provider: { id: 'zhipu', label: '智谱', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKey: 'zk', model: 'glm-4.7-flash' },
    })
  })

  test('只配 DeepSeek → 用 DeepSeek', () => {
    const sel = selectProvider({ DEEPSEEK_API_KEY: 'dk' })
    expect(sel.status).toBe('ready')
    if (sel.status === 'ready') {
      expect(sel.provider.id).toBe('deepseek')
      expect(sel.provider.baseUrl).toBe('https://api.deepseek.com')
      expect(sel.provider.model).toBe('deepseek-flash')
    }
  })

  test('两家都配且未指定 AI_PROVIDER → 按注册表顺序取第一家（zhipu）', () => {
    const sel = selectProvider({ ZHIPU_API_KEY: 'zk', DEEPSEEK_API_KEY: 'dk' })
    expect(sel.status).toBe('ready')
    if (sel.status === 'ready') expect(sel.provider.id).toBe('zhipu')
  })

  test('AI_PROVIDER 显式指定 DeepSeek → 覆盖表序', () => {
    const sel = selectProvider({ ZHIPU_API_KEY: 'zk', DEEPSEEK_API_KEY: 'dk', AI_PROVIDER: 'deepseek' })
    expect(sel.status).toBe('ready')
    if (sel.status === 'ready') expect(sel.provider.id).toBe('deepseek')
  })

  test('AI_PROVIDER 不认识 → misconfigured 列出可选值', () => {
    const sel = selectProvider({ AI_PROVIDER: 'kimi' })
    expect(sel.status).toBe('misconfigured')
    if (sel.status !== 'ready') expect(sel.message).toContain('zhipu / deepseek')
  })

  test('AI_PROVIDER 指定了一家但 key 没配 → misconfigured 点名缺哪个变量', () => {
    const sel = selectProvider({ ZHIPU_API_KEY: 'zk', AI_PROVIDER: 'deepseek' })
    expect(sel.status).toBe('misconfigured')
    if (sel.status !== 'ready') expect(sel.message).toContain('DEEPSEEK_API_KEY')
  })

  test('各家 BASE_URL / MODEL 可独立覆盖（尾斜杠归一）', () => {
    const sel = selectProvider({
      DEEPSEEK_API_KEY: 'dk',
      DEEPSEEK_BASE_URL: 'https://proxy.example/v1/',
      DEEPSEEK_MODEL: 'deepseek-v4-pro',
    })
    expect(sel.status).toBe('ready')
    if (sel.status === 'ready') {
      expect(sel.provider.baseUrl).toBe('https://proxy.example/v1')
      expect(sel.provider.model).toBe('deepseek-v4-pro')
    }
  })

  test('AI_PROVIDER 空串 = 未指定（走自动探测）', () => {
    const sel = selectProvider({ AI_PROVIDER: '  ', DEEPSEEK_API_KEY: 'dk' })
    expect(sel.status).toBe('ready')
    if (sel.status === 'ready') expect(sel.provider.id).toBe('deepseek')
  })
})
