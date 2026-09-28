import { render, screen } from '@testing-library/react'
import { DrillFeedback } from '../../src/app/(drill)/DrillFeedback.js'

const variant = { optionTexts: ['对1', '错勾', '对2', '漏', 'x', 'x', 'x', 'x', 'x'], correctIndices: [0, 2, 3], distractorKeyPointIds: ['kp-x'] }
const submission = { submissionId: 's', cardId: 'c1', reviewedAtMs: 0, kind: 'selection' as const, selected: [0, 1, 2] }
const base = {
  card: {
    cardId: 'c1', blockName: 'MVCC', question: 'undo log 有哪些作用？',
    cardType: 'enumeration' as const, keyPoints: [],
  } as never,
  variant, submission,
}

test('显示得分、漏几条/错勾几条', () => {
  render(<DrillFeedback {...base} offline={false}
    result={{ score: { num: 2, den: 3 }, remainingPlan: ['2026-09-25', '2026-10-01'], replanned: false,
      feedback: { correctChecked: 2, wrongChecked: 1, missed: 1 } } as never} />)
  expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument()
  expect(screen.getByText(/漏.*1/)).toBeInTheDocument()
  expect(screen.getByText(/错勾.*1/)).toBeInTheDocument()
})

test('逐条染色：勾对绿、漏选黄、错勾红（用 data-state 标记断言）', () => {
  render(<DrillFeedback {...base} offline={false}
    result={{ score: { num: 2, den: 3 }, remainingPlan: [], replanned: false, feedback: { correctChecked: 2, wrongChecked: 1, missed: 1 } } as never} />)
  const opts = screen.getAllByTestId('option')
  expect(opts[0]).toHaveAttribute('data-state', 'correct')   // 勾对
  expect(opts[1]).toHaveAttribute('data-state', 'wrong')     // 错勾
  expect(opts[3]).toHaveAttribute('data-state', 'missed')    // 漏选
})

test('三态文字徽标：不依赖颜色也能区分勾对/漏选/错勾（无障碍）', () => {
  render(<DrillFeedback {...base} offline={false}
    result={{ score: { num: 2, den: 3 }, remainingPlan: [], replanned: false, feedback: { correctChecked: 2, wrongChecked: 1, missed: 1 } } as never} />)
  const opts = screen.getAllByTestId('option')
  expect(opts[0]!.textContent).toContain('勾对')
  expect(opts[1]!.textContent).toContain('错勾')
  expect(opts[3]!.textContent).toContain('漏选')
})

test('批改版上下文：题面可见 + 每个选项带当时的勾选痕迹（☑/☐）', () => {
  render(<DrillFeedback {...base} offline={false}
    result={{ score: { num: 2, den: 3 }, remainingPlan: [], replanned: false, feedback: { correctChecked: 2, wrongChecked: 1, missed: 1 } } as never} />)
  expect(screen.getByText('undo log 有哪些作用？')).toBeInTheDocument()   // 题面不丢
  const opts = screen.getAllByTestId('option')
  expect(opts[0]!.textContent).toContain('☑')   // 我勾了（selected: [0,1,2]）
  expect(opts[1]!.textContent).toContain('☑')
  expect(opts[3]!.textContent).toContain('☐')   // 漏选的没勾
})

test('答错重排：显式渲染「计划已重排」', () => {
  render(<DrillFeedback {...base} offline={false}
    result={{ score: { num: 1, den: 3 }, remainingPlan: ['2026-09-25'], replanned: true, feedback: { correctChecked: 1, wrongChecked: 0, missed: 2 } } as never} />)
  expect(screen.getByText('计划已重排')).toBeInTheDocument()
})

test('离线：渲染「计划将在联网后更新」，圆点用本地缓存的剩余计划', () => {
  render(<DrillFeedback {...base} offline={true}
    result={{ score: { num: 2, den: 3 }, remainingPlan: ['2026-09-25'], replanned: false, feedback: { correctChecked: 2, wrongChecked: 1, missed: 1 } } as never} />)
  expect(screen.getByText('计划将在联网后更新')).toBeInTheDocument()
})

test('圆点序列：N 个节点，末尾为面试日红点', () => {
  render(<DrillFeedback {...base} offline={false}
    result={{ score: { num: 3, den: 3 }, remainingPlan: ['2026-09-25', '2026-10-01'], replanned: false, feedback: { correctChecked: 3, wrongChecked: 0, missed: 0 } } as never} />)
  expect(screen.getAllByTestId('plan-dot')).toHaveLength(2)
  expect(screen.getByTestId('plan-dot-final')).toBeInTheDocument()
})
