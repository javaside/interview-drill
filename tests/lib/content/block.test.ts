import { parseBlock } from '../../../src/lib/content/block.js'

const SRC = `id: mysql/mvcc-undo
name: MVCC 与 Undo Log
category: mysql
status: wip
`

test('解析出块元数据', () => {
  const r = parseBlock(SRC, 'content/mysql/mvcc-undo/block.yml')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.block.name).toBe('MVCC 与 Undo Log')
  expect(r.block.category).toBe('mysql')
  expect(r.block.status).toBe('wip')
})

test('status 缺省为 wip —— 新块默认不受池容量校验', () => {
  const r = parseBlock('id: x\nname: 索引与执行计划\ncategory: mysql\n', 'content/x/block.yml')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.block.status).toBe('wip')
})

test('块名命中 B5 黑名单被拒', () => {
  const r = parseBlock(SRC.replace('MVCC 与 Undo Log', 'MySQL 基础'), 'content/x/block.yml')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.join()).toContain('基础')
})

test('缺字段时报错带路径', () => {
  const r = parseBlock('id: x', 'content/x/block.yml')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.join()).toContain('content/x/block.yml')
})
