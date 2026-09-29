import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrillQuestion } from '../../src/app/(drill)/DrillQuestion.js'
import type { CardView } from '../../src/server/queue.js'
import type { PreparedVariant } from '../../src/lib/options/prepare.js'

const card: CardView = {
  cardId: 'c1', blockId: 'b1', blockName: 'MySQL 索引', cardType: 'enumeration',
  frequency: 'high', question: 'B+ 树索引的特点？', keyPoints: [],
  detail: 'B+ 树是为磁盘存储优化的多路平衡树：非叶节点只存键、叶子节点存数据并按序链成链表。',
}
const variant: PreparedVariant = {
  optionTexts: ['叶子有序链表', '干扰A', '非叶只存键', '干扰B', '干扰C', '磁盘友好', '干扰D', '干扰E', '干扰F'],
  correctIndices: [0, 2, 5], distractorKeyPointIds: [],
}

test('渲染块名/频度/题面 + 9 个选项，不显示正确条数', () => {
  render(<DrillQuestion card={card} variant={variant} onSubmit={() => {}} />)
  expect(screen.getByText('MySQL 索引')).toBeInTheDocument()
  expect(screen.getByText('B+ 树索引的特点？')).toBeInTheDocument()
  expect(screen.getAllByRole('checkbox')).toHaveLength(9)
  expect(screen.getByText('勾出所有属于这道题的要点')).toBeInTheDocument()
  expect(screen.queryByText(/正确.*条|选\s*\d+\s*项/)).toBeNull()
})

test('先学后练：默认不显示讲解，点「先看讲解」展开题解（不会的用户先学再答）', async () => {
  const u = userEvent.setup()
  render(<DrillQuestion card={card} variant={variant} onSubmit={() => {}} />)
  expect(screen.queryByText(/B\+ 树是为磁盘存储优化/)).toBeNull()   // 默认收起（不泄题面）
  await u.click(screen.getByRole('button', { name: /先看讲解/ }))
  expect(screen.getByText(/B\+ 树是为磁盘存储优化/)).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: /收起|先看讲解/ }))   // 可再收起
  expect(screen.queryByText(/B\+ 树是为磁盘存储优化/)).toBeNull()
})

test('空勾选时提交禁用；勾一项后启用', async () => {
  const u = userEvent.setup()
  render(<DrillQuestion card={card} variant={variant} onSubmit={() => {}} />)
  const submit = screen.getByRole('button', { name: /交卷/ })
  expect(submit).toBeDisabled()
  await u.click(screen.getAllByRole('checkbox')[0]!)
  expect(submit).toBeEnabled()
})

test('提交回调带勾选下标（selection）', async () => {
  const u = userEvent.setup()
  const onSubmit = vi.fn()
  render(<DrillQuestion card={card} variant={variant} onSubmit={onSubmit} />)
  await u.click(screen.getAllByRole('checkbox')[0]!)
  await u.click(screen.getAllByRole('checkbox')[2]!)
  await u.click(screen.getByRole('button', { name: /交卷/ }))
  expect(onSubmit).toHaveBeenCalledWith({ kind: 'selection', selected: [0, 2] })
})

test('atomic 型 4 个单选，选一个即可提交', () => {
  render(<DrillQuestion card={{ ...card, cardType: 'atomic' }}
    variant={{ optionTexts: ['A', 'B', 'C', 'D'], correctIndices: [0], distractorKeyPointIds: [] }} onSubmit={() => {}} />)
  expect(screen.getAllByRole('radio')).toHaveLength(4)
})

test('sequence 型提示为排序指引，不出现勾选文案（排序题没有可勾选项）', () => {
  render(<DrillQuestion card={{ ...card, cardType: 'sequence' }}
    variant={{ optionTexts: ['第 1 步', '第 2 步', '第 3 步', '第 4 步'], correctIndices: [1, 0, 3, 2], distractorKeyPointIds: [] }}
    onSubmit={() => {}} />)
  expect(screen.getByText('把要点排成正确的先后顺序')).toBeInTheDocument()
  expect(screen.queryByText('勾出所有属于这道题的要点')).toBeNull()
})

test('atomic 型提示为单选指引，不出现「勾出所有」文案', () => {
  render(<DrillQuestion card={{ ...card, cardType: 'atomic' }}
    variant={{ optionTexts: ['A', 'B', 'C', 'D'], correctIndices: [0], distractorKeyPointIds: [] }} onSubmit={() => {}} />)
  expect(screen.getByText('选出正确的一项')).toBeInTheDocument()
  expect(screen.queryByText('勾出所有属于这道题的要点')).toBeNull()
})

test('judgment 型提示覆盖两步交互：先选结论再勾要点', () => {
  render(<DrillQuestion card={{ ...card, cardType: 'judgment' }} variant={variant} onSubmit={() => {}} />)
  expect(screen.getByText('先选结论，再勾出所有属于这道题的要点')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: '会' })).toBeInTheDocument()
})
