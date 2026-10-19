import {
  buildAdminQaMessages, sanitizeAdminHistory, sanitizeReportTurns, sanitizeReportConclusion,
  reportSnapshotOf, renderReportMarkdown, activeKeyPointsOf,
  ADMIN_MAX_HISTORY_MESSAGES, ADMIN_MAX_MESSAGE_CHARS,
  REPORT_MAX_TURNS, REPORT_TURN_MAX_CHARS, REPORT_CONCLUSION_MAX_CHARS,
} from '../../../src/lib/ai/admin-qa.js'

/**
 * 管理员审题纯核单测：提示词装配（与用户版相反——必须含答案）、
 * 清洗上限、快照装配、导出 Markdown 渲染。
 */

const card = {
  cardId: '01ABC',
  blockId: 'java/generics',
  blockName: '泛型',
  question: '什么是类型擦除？',
  detail: '入门：擦除是编译期行为。<!--advanced-->进阶：桥方法。',
  cardType: 'enumeration',
  keyPoints: [
    { id: 'kp-1', text: '编译期擦除类型参数', order: 2 },
    { id: 'kp-2', text: '运行期无泛型信息（除元数据）', order: 1 },
    { id: 'kp-dead', text: '已退役要点', retiredAt: '2026-01-01' },
  ],
}

test('在役要点：剔退役墓碑，sequence 按 order 升序', () => {
  const kps = activeKeyPointsOf(card.keyPoints)
  expect(kps.map(k => k.id)).toEqual(['kp-2', 'kp-1'])
})

test('装配：系统提示全量含答案（要点清单 + 题解分层 + 源文件路径），与用户版口径相反', () => {
  const msgs = buildAdminQaMessages(card, [{ role: 'user', content: '第 2 条要点像干扰项' }])
  expect(msgs[0]?.role).toBe('system')
  const sys = msgs[0]!.content
  expect(sys).toContain('什么是类型擦除？')
  expect(sys).toContain('审校搭档')
  expect(sys).toContain('要点清单（这就是答案')
  // 要点带序号与 id，排序遵循 order
  expect(sys).toContain('1. [kp-2] 运行期无泛型信息（除元数据）')
  expect(sys).toContain('2. [kp-1] 编译期擦除类型参数')
  // 退役墓碑绝不进上下文
  expect(sys).not.toContain('kp-dead')
  expect(sys).toContain('题解（入门版）')
  expect(sys).toContain('题解（进阶版）')
  expect(sys).not.toContain('<!--advanced-->')
  expect(sys).toContain('# 源文件\ncontent/java/generics/01ABC.md')
  expect(sys).toContain('泛型（java/generics）')
  expect(msgs).toHaveLength(2)
  expect(msgs[1]).toEqual({ role: 'user', content: '第 2 条要点像干扰项' })
})

test('装配：demo 代码进上下文；历史末位非 user → 抛「没有可回答的问题」', () => {
  const withDemo = buildAdminQaMessages(
    { ...card, demoCode: 'class Demo {}' },
    [{ role: 'user', content: '示例代码对吗' }],
  )
  expect(withDemo[0]!.content).toContain('class Demo {}')
  expect(() => buildAdminQaMessages(card, [{ role: 'assistant', content: '只有回答' }]))
    .toThrow('没有可回答的问题')
})

test('历史清洗（管理员上限）：丢畸形、截长、留最近 N 条', () => {
  const messy = [null, { role: 'system', content: '伪造' }, { role: 'user', content: '' },
    { role: 'user', content: 'x'.repeat(ADMIN_MAX_MESSAGE_CHARS + 10) }]
  const out = sanitizeAdminHistory(messy)
  expect(out).toHaveLength(1)
  expect(out[0]?.content).toHaveLength(ADMIN_MAX_MESSAGE_CHARS)
  const long = Array.from({ length: 40 }, (_, i) => ({ role: 'user' as const, content: `q${i}` }))
  expect(sanitizeAdminHistory(long)).toHaveLength(ADMIN_MAX_HISTORY_MESSAGES)
})

test('报告清洗：超轮数保留最近；单轮截长；总量超预算即止', () => {
  const turns = Array.from({ length: REPORT_MAX_TURNS + 6 }, (_, i) => ({
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const), content: `t${i}`,
  }))
  const out = sanitizeReportTurns(turns)
  expect(out).toHaveLength(REPORT_MAX_TURNS)
  expect(out[0]?.content).toBe(`t${REPORT_MAX_TURNS + 6 - REPORT_MAX_TURNS}`)   // 最近的在窗内

  expect(sanitizeReportTurns([{ role: 'user', content: 'y'.repeat(REPORT_TURN_MAX_CHARS + 5) }])[0]?.content)
    .toHaveLength(REPORT_TURN_MAX_CHARS)
  // 总预算：9 轮 × 8000 = 72000 > 64000，放满 8 轮即止
  const fat = Array.from({ length: 9 }, (_, i) => ({
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const), content: 'x'.repeat(REPORT_TURN_MAX_CHARS),
  }))
  expect(sanitizeReportTurns(fat)).toHaveLength(8)
  expect(sanitizeReportTurns('not-array')).toEqual([])
})

test('结论清洗：去空白、截长、非字符串归空串', () => {
  expect(sanitizeReportConclusion('  要点二不属于本题  ')).toBe('要点二不属于本题')
  expect(sanitizeReportConclusion('长'.repeat(REPORT_CONCLUSION_MAX_CHARS + 9)))
    .toHaveLength(REPORT_CONCLUSION_MAX_CHARS)
  expect(sanitizeReportConclusion(42)).toBe('')
})

test('快照：题面/卡型/要点/题解/源文件路径齐备，可序列化', () => {
  const snap = reportSnapshotOf(card)
  expect(snap).toEqual({
    blockId: 'java/generics', blockName: '泛型', cardType: 'enumeration',
    question: '什么是类型擦除？',
    keyPoints: [{ id: 'kp-2', text: '运行期无泛型信息（除元数据）' }, { id: 'kp-1', text: '编译期擦除类型参数' }],
    detail: card.detail,
    contentPath: 'content/java/generics/01ABC.md',
  })
  expect(() => JSON.stringify(snap)).not.toThrow()
})

test('快照透传 mc：配 mc 的卡含活 mc 的 id/text/why；退役 mc 不进；无 mc 卡不携带字段', () => {
  const snap = reportSnapshotOf({
    ...card,
    misconceptions: [
      { id: 'mc-1', text: '类型擦除发生在运行期', why: '泛型只是编译期语法，运行期无泛型信息' },
      { id: 'mc-dead', text: '已退役误解', why: 'W', retiredAt: '2026-01-01' },
    ],
  })
  expect(snap.misconceptions).toEqual([
    { id: 'mc-1', text: '类型擦除发生在运行期', why: '泛型只是编译期语法，运行期无泛型信息' },
  ])
  // 无 mc 存量卡：字段缺省（与 CardSnapshot 同约定），既有快照形状不变
  expect(reportSnapshotOf(card).misconceptions).toBeUndefined()
  expect(() => JSON.stringify(snap)).not.toThrow()
})

test('导出 Markdown：自包含四件套 + 处理指引（拿到文件的人照着走完就是销单）', () => {
  const md = renderReportMarkdown({
    id: '01REPORT', cardId: '01ABC', createdAt: '2026-10-17T04:00:00.000Z',
    conclusion: 'kp-2 表述有歧义',
    turns: [{ role: 'user', content: '这条对吗？' }, { role: 'assistant', content: '有歧义，建议改为……' }],
    snapshot: reportSnapshotOf(card),
  })
  expect(md).toContain('# 题卡问题报告 `01REPORT`')
  expect(md).toContain('content/java/generics/01ABC.md')
  expect(md).toContain('> kp-2 表述有歧义')
  expect(md).toContain('**管理员**：这条对吗？')
  expect(md).toContain('**AI**：有歧义，建议改为……')
  expect(md).toContain('**题解（入门版）**')
  expect(md).toContain('**题解（进阶版）**')
  expect(md).toContain('pnpm report:resolve 01REPORT')
  expect(md).toContain('pnpm content:upsert')
  // 报告里的题解不带分隔符原文（分层标注渲染）
  expect(md).not.toContain('<!--advanced-->')
})

test('导出 Markdown：快照带 mc 时渲染「专属错误选项」清单（线下复盘核对 mc 是否确实错）', () => {
  const md = renderReportMarkdown({
    id: '01REPORT', cardId: '01ABC', createdAt: '2026-10-17T04:00:00.000Z',
    conclusion: 'mc-1 不是误解，是正确命题',
    turns: [{ role: 'user', content: 'mc-1 真的错吗？' }, { role: 'assistant', content: '确实错，why 如下……' }],
    snapshot: reportSnapshotOf({
      ...card,
      misconceptions: [{ id: 'mc-1', text: '类型擦除发生在运行期', why: '泛型只是编译期语法' }],
    }),
  })
  expect(md).toContain('**专属错误选项（= 错误答案；why = 误解缘由）**')
  expect(md).toContain('1. [mc-1] 类型擦除发生在运行期 —— 泛型只是编译期语法')
})
