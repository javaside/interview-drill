import { render, screen } from '@testing-library/react'
import { PublicQuestionView } from '../../src/app/q/[cardId]/PublicQuestionView.js'

const card = { cardId: 'c1', question: 'B+ 树的特点？', blockName: 'MySQL 索引',
  publicKeyPoints: [{ id: 'k0', text: '叶子有序链表' }, { id: 'k1', text: '非叶只存键' }], totalKeyPoints: 5 }

test('渲染题面 + public 要点 + 「完整 N 条在 App 内」入口', () => {
  render(<PublicQuestionView card={card as never} />)
  expect(screen.getByText('B+ 树的特点？')).toBeInTheDocument()
  expect(screen.getByText('叶子有序链表')).toBeInTheDocument()
  expect(screen.getByText(/完整\s*5\s*条/)).toBeInTheDocument()
  // 入口链到 App，不是第二处付费墙话术
  expect(screen.getByRole('link')).toHaveAttribute('href', '/')
})

test('无 cloaking：视图只吃 PublicCard，结构里没有隐藏的全文分支', () => {
  const { container } = render(<PublicQuestionView card={card as never} />)
  // 只渲染传入的 2 条 public 要点，没有多出来的列表项
  expect(container.querySelectorAll('[data-testid="public-kp"]')).toHaveLength(2)
})
