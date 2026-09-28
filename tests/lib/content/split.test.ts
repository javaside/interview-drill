import { splitDetail } from '../../../src/lib/content/split.js'

test('splitDetail：带分层标记 → 入门版/进阶版', () => {
  const { intro, advanced } = splitDetail('零基础能懂。\n\n<!--advanced-->\n面试深度细节。')
  expect(intro).toBe('零基础能懂。')
  expect(advanced).toBe('面试深度细节。')
})

test('splitDetail：无标记 → 全文为入门版，进阶为空（旧内容兼容）', () => {
  const { intro, advanced } = splitDetail('只有一层的老讲解。')
  expect(intro).toBe('只有一层的老讲解。')
  expect(advanced).toBe('')
})
