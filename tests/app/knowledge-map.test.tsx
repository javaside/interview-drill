import { render, screen } from '@testing-library/react'
import { KnowledgeMap } from '../../src/app/map/KnowledgeMap.js'

const entries = [
  { blockId: 'b1', blockName: 'MySQL 索引', category: 'db', cardCount: 23, unlocked: true, mastery: { kind: 'score', value: { num: 1, den: 2 } } },
  { blockId: 'b2', blockName: 'Redis', category: 'db', cardCount: 18, unlocked: false, mastery: { kind: 'untried' } },
  { blockId: 'b3', blockName: 'JVM', category: 'jvm', cardCount: 30, unlocked: true, mastery: { kind: 'untried' } },
] as never

test('解锁块可进入（链到 /?block）、显示掌握度百分比', () => {
  render(<KnowledgeMap entries={entries} />)
  const b1 = screen.getByTestId('block-b1')
  expect(b1).toHaveTextContent('MySQL 索引')
  expect(b1.querySelector('a')).toHaveAttribute('href', expect.stringContaining('b1'))
  expect(b1).toHaveTextContent('50%')          // score 1/2
})

test('未刷解锁块显示「未刷」而非 0%', () => {
  render(<KnowledgeMap entries={entries} />)
  expect(screen.getByTestId('block-b3')).toHaveTextContent('未刷')
})

test('未解锁块：显示「N 题」且是链到 /upgrade 的唯一转化入口', () => {
  render(<KnowledgeMap entries={entries} />)
  const b2 = screen.getByTestId('block-b2')
  expect(b2).toHaveTextContent('18 题')
  const locked = screen.getByTestId('locked-block')
  expect(locked).toHaveAttribute('href', '/upgrade')
  expect(screen.getAllByTestId('locked-block')).toHaveLength(1)   // 全页唯一
})

test('岗位 tab：tracks 存在时渲染导航，当前岗位高亮（aria-current）', () => {
  const tracks = [
    { id: 'java-backend', name: 'Java 后端' },
    { id: 'agent-dev', name: 'Agent 开发' },
  ]
  render(<KnowledgeMap entries={entries} tracks={tracks} activeTrackId="agent-dev" />)
  const all = screen.getByRole('link', { name: '全部' })
  expect(all).toHaveAttribute('href', '/map')
  expect(all).not.toHaveAttribute('aria-current', 'page')
  const agent = screen.getByRole('link', { name: 'Agent 开发' })
  expect(agent).toHaveAttribute('href', '/map?track=agent-dev')
  expect(agent).toHaveAttribute('aria-current', 'page')
})

test('无 tracks（老库）不渲染岗位 tab', () => {
  render(<KnowledgeMap entries={entries} />)
  expect(screen.queryByRole('link', { name: '全部' })).not.toBeInTheDocument()
})

// ===== 匿名目录模式（authed=false，登录逻辑 v2：知识库默认可见）=====

test('匿名目录：每块统一「刷题」入口指向 /practice，绝不出 /upgrade 解锁位', () => {
  render(<KnowledgeMap entries={entries} authed={false} />)
  // 未解锁的 b2 也只是普通目录行，不出付费转化位
  expect(screen.getByTestId('block-b2')).toHaveTextContent('18 题')
  expect(screen.queryByTestId('locked-block')).not.toBeInTheDocument()
  expect(screen.getAllByTestId('catalog-practice')).toHaveLength(3)
  expect(screen.getByTestId('block-b1').querySelector('[data-testid="catalog-practice"]'))
    .toHaveAttribute('href', '/practice?block=b1')
})

test('匿名目录不渲染掌握度——无百分比、无「未刷」', () => {
  render(<KnowledgeMap entries={entries} authed={false} />)
  expect(screen.getByTestId('block-b1').textContent).not.toContain('掌握')
  expect(screen.getByTestId('block-b1').textContent).not.toContain('50%')
  expect(screen.getByTestId('block-b3').textContent).not.toContain('未刷')
  expect(screen.getByTestId('block-b1')).toHaveTextContent('23 题')
})

test('默认 authed=true：现有已登录行为不变（解锁位/掌握度照旧）', () => {
  render(<KnowledgeMap entries={entries} />)
  expect(screen.getByTestId('locked-block')).toBeInTheDocument()
  expect(screen.getByTestId('block-b1')).toHaveTextContent('掌握 50%')
  expect(screen.queryByTestId('catalog-practice')).not.toBeInTheDocument()
})
