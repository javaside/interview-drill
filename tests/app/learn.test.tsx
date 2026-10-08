import { render, screen } from '@testing-library/react'
import { LearnView } from '../../src/app/learn/LearnView.js'
import type { LearnCard } from '../../src/app/learn/LearnView.js'

const cards: LearnCard[] = [
  {
    cardId: 'c1', question: 'InnoDB 的 undo log 有哪些作用？', frequency: 'high',
    detail: 'undo log 是事务原子性和 MVCC 的共同基础，记录每次修改的前像……',
  },
  {
    cardId: 'c2', question: 'RC 和 RR 下 ReadView 生成时机？', frequency: 'mid',
    detail: 'RC 每次快照读都生成新 ReadView；RR 只在第一次读时生成并复用……',
  },
]

test('学习页：按卡列出题面 + 完整讲解（教材在前）', () => {
  render(<LearnView blockName="MVCC 与 Undo Log" cards={cards} blockId="mysql/mvcc-undo" />)
  expect(screen.getByText('MVCC 与 Undo Log')).toBeInTheDocument()
  expect(screen.getByText('InnoDB 的 undo log 有哪些作用？')).toBeInTheDocument()
  expect(screen.getByText(/undo log 是事务原子性和 MVCC 的共同基础/)).toBeInTheDocument()
  expect(screen.getByText(/RC 每次快照读都生成新 ReadView/)).toBeInTheDocument()
})

test('学完测试入口：链到 /practice?block=（习题在后）', () => {
  render(<LearnView blockName="B" cards={cards} blockId="mysql/mvcc-undo" />)
  const cta = screen.getByRole('link', { name: /开始测试/ })
  expect(cta).toHaveAttribute('href', '/practice?block=mysql/mvcc-undo')
})

test('未解锁块：显示解锁引导（卡数 + 升级/设为免费块出口），不露题面也不给测试入口', () => {
  render(
    <LearnView blockName="进程与线程" cards={[]} blockId="os/process-thread" locked cardCount={30} />,
  )
  // 引导文案含真实卡数（卡数在知识地图本就公开，非机密）
  expect(screen.getByText('30')).toBeInTheDocument()
  expect(screen.getByText(/还没有解锁/)).toBeInTheDocument()
  // 两个出口：升级 / 设置里改选免费块
  expect(screen.getByRole('link', { name: /解锁全部大类/ })).toHaveAttribute('href', '/upgrade')
  expect(screen.getByRole('link', { name: /设置/ })).toHaveAttribute('href', '/settings')
  // 没有测试入口，也不出现「没有学习材料」的误导文案
  expect(screen.queryByRole('link', { name: /开始测试/ })).not.toBeInTheDocument()
  expect(screen.queryByText(/还没有学习材料/)).not.toBeInTheDocument()
})

test('卡片带 demoCode → 正文后渲染可运行示例', () => {
  render(<LearnView blockName="泛型" blockId="java/generics" cards={[{
    cardId: 'c1', question: 'Q1', frequency: 'high', detail: '讲解',
    demoCode: 'public class BridgeMethodDemo { }',
  }]} />)
  expect(screen.getByText('可运行示例（Java）')).toBeInTheDocument()
  expect(document.querySelector('pre')?.textContent).toContain('BridgeMethodDemo')
})

test('卡片无 demoCode → 不渲染示例块', () => {
  render(<LearnView blockName="泛型" blockId="java/generics" cards={[{
    cardId: 'c1', question: 'Q1', frequency: 'high', detail: '讲解',
  }]} />)
  expect(screen.queryByText('可运行示例（Java）')).not.toBeInTheDocument()
})
