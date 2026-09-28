import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

/** judgment 卡：题面 + 结论三选 + 要点勾选（卡 4 实型） */
const judgmentBase = {
  card: {
    cardId: 'c9', blockName: 'MVCC', question: 'RR 隔离级别下 MVCC 能完全避免幻读吗？',
    cardType: 'judgment' as const, conclusion: 'no' as const, detail: '先说**幻读**是什么……',
    keyPoints: [],
  } as never,
  variant,
  submission: { submissionId: 's9', cardId: 'c9', reviewedAtMs: 0, kind: 'judgment' as const, conclusion: 0 as const, selected: [0] },
}

test('judgment 结论批改：正确答案 + 我的选择 + 对错都显示', () => {
  render(<DrillFeedback {...judgmentBase} offline={false}
    result={{ score: { num: 0, den: 3 }, remainingPlan: [], replanned: false, feedback: { correctChecked: 0, wrongChecked: 1, missed: 2 } } as never} />)
  expect(screen.getByText('你的结论（批改）')).toBeInTheDocument()
  const rows = screen.getAllByTestId('conclusion-row')
  expect(rows).toHaveLength(3)
  // 正确答案 = conclusion 'no' → 「不会」，标正确
  const right = rows.find(r => r.textContent?.includes('不会'))!
  expect(right.getAttribute('data-correct')).toBe('true')
  expect(right.textContent).toContain('正确答案')
  // 我选了「会」（0）→ 标我的选择
  const mine = rows.find(r => r.textContent?.includes('会') && r !== right)!
  expect(mine.getAttribute('data-mine')).toBe('true')
  expect(mine.textContent).toContain('你的选择')
})

test('批改页有「看讲解」入口：展开显示入门讲解（术语当场可查）', async () => {
  const u = userEvent.setup()
  render(<DrillFeedback {...judgmentBase} offline={false}
    result={{ score: { num: 0, den: 3 }, remainingPlan: [], replanned: false, feedback: { correctChecked: 0, wrongChecked: 1, missed: 2 } } as never} />)
  await u.click(screen.getByRole('button', { name: /看讲解/ }))
  expect(screen.getByText('幻读')).toBeInTheDocument()   // **幻读** 粗体段（RichText 拆分后独立元素）
})

/** sequence 卡：对错是位置不是勾选（update 顺序题实型） */
const seqBase = {
  card: {
    cardId: 'c7', blockName: 'MVCC', question: '一条 update 语句提交时，undo log、redo log、binlog 的写入顺序是怎样的？',
    cardType: 'sequence' as const, detail: '', keyPoints: [],
  } as never,
  // 呈现 [A,B,C,D]，正确的呈现顺序 = correctIndices = [1,0,3,2]（即 B,A,D,C）
  variant: { optionTexts: ['A', 'B', 'C', 'D'], correctIndices: [1, 0, 3, 2], distractorKeyPointIds: [] },
  submission: { submissionId: 's7', cardId: 'c7', reviewedAtMs: 0, kind: 'sequence' as const, order: [1, 0, 2, 3] },
}

test('sequence 批改：每行显示你的位置与应在位置（位置对绿 / 错位标「应在第 N 位」）', () => {
  render(<DrillFeedback {...seqBase} offline={false}
    result={{ score: { num: 1, den: 2 }, remainingPlan: [], replanned: false, feedback: { correctChecked: 2, wrongChecked: 2, missed: 0 } } as never} />)
  expect(screen.getByText('你的排序（批改）')).toBeInTheDocument()
  const rows = screen.getAllByTestId('seq-row')
  expect(rows).toHaveLength(4)
  // 位置 0（B）与位置 1（A）位置正确
  expect(rows[0]!.textContent).toContain('✓ 位置正确')
  expect(rows[1]!.textContent).toContain('✓ 位置正确')
  // 用户位置 2 排的是 C（下标 2），正确顺序该位是 D → C 应在位置 3
  expect(rows[2]!.textContent).toContain('应在第 4 位')
  expect(rows[3]!.textContent).toContain('应在第 3 位')
  // 不出现勾选语义的漏选/错勾徽标
  expect(rows.every(r => !r.textContent!.includes('漏选') && !r.textContent!.includes('错勾'))).toBe(true)
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
