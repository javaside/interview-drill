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
