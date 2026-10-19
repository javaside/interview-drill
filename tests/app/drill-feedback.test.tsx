import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrillFeedback } from '../../src/app/(drill)/DrillFeedback.js'

const variant = { optionTexts: ['对1', '错勾', '对2', '漏', 'x', 'x', 'x', 'x', 'x'], correctIndices: [0, 2, 3], distractorKeyPointIds: ['kp-x'], misconceptionIds: [] }
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
    cardId: 'c9', blockName: 'MVCC', question: 'RR 隔离级别下 MVCC 会完全避免幻读吗？',
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
  variant: { optionTexts: ['A', 'B', 'C', 'D'], correctIndices: [1, 0, 3, 2], distractorKeyPointIds: [], misconceptionIds: [] },
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

test('atomic 批改屏：提示为「你的选择（批改）」，不出现「勾出所有」文案', () => {
  render(<DrillFeedback
    card={{ cardId: 'c5', blockName: 'MVCC', question: '哪条日志先写？', cardType: 'atomic' as const, keyPoints: [] } as never}
    variant={{ optionTexts: ['redo log', 'binlog', 'undo log', 'doublewrite'], correctIndices: [0], distractorKeyPointIds: [], misconceptionIds: [] }}
    submission={{ submissionId: 's5', cardId: 'c5', reviewedAtMs: 0, kind: 'atomic' as const, selected: 1 }}
    offline={false}
    result={{ score: { num: 0, den: 1 }, remainingPlan: [], replanned: false, feedback: { correctChecked: 0, wrongChecked: 1, missed: 0 } } as never} />)
  expect(screen.getByText('你的选择（批改）')).toBeInTheDocument()
  expect(screen.queryByText('勾出所有属于这道题的要点（批改）')).toBeNull()
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

test('demoCode 存在 → 讲解区下方渲染可运行示例折叠块（spec §5）', () => {
  render(<DrillFeedback
    card={{
      cardId: 'c1', blockName: 'MVCC', question: 'undo log 有哪些作用？',
      cardType: 'enumeration' as const, keyPoints: [],
      demoCode: 'public class IntegerCacheDemo { }',
    } as never}
    variant={base.variant} submission={base.submission} offline={false}
    result={{ score: { num: 2, den: 3 }, remainingPlan: [], replanned: false, feedback: { correctChecked: 2, wrongChecked: 1, missed: 1 } } as never} />)
  expect(screen.getByText('可运行示例（Java）')).toBeInTheDocument()
  expect(document.querySelector('pre')?.textContent).toContain('IntegerCacheDemo')
})

test('无 demoCode → 不渲染示例块（字段缺省即无渲染）', () => {
  const { container } = render(<DrillFeedback {...base} offline={false}
    result={{ score: { num: 2, den: 3 }, remainingPlan: [], replanned: false, feedback: { correctChecked: 2, wrongChecked: 1, missed: 1 } } as never} />)
  // base 夹具无 detail（讲解折叠不展开）、无 demoCode——全树不应出现任何 details 折叠块
  expect(container.querySelector('details')).toBeNull()
  expect(screen.queryByText('可运行示例（Java）')).toBeNull()
})

const pass = { score: { num: 3, den: 3 }, remainingPlan: [], replanned: false, feedback: { correctChecked: 3, wrongChecked: 0, missed: 0 } } as never

test('收束区：正确要点单独列成「记住这几条」清单（判分后的 take-away）', () => {
  render(<DrillFeedback {...base} offline={false} result={pass} />)
  const takeaway = screen.getByTestId('takeaway')
  const items = takeaway.querySelectorAll('li')
  expect(items).toHaveLength(3)                                  // = correctIndices [0,2,3]
  expect(items[0]!.textContent).toContain('对1')
  expect(items[1]!.textContent).toContain('对2')
  expect(items[2]!.textContent).toContain('漏')
  expect(takeaway.textContent).not.toContain('错勾')             // 干扰项不进收束清单
})

test('收束区：提供「回学习页」入口，链到 /learn?block=', () => {
  render(
    <DrillFeedback
      card={{
        cardId: 'c1', blockId: 'mysql/mvcc-undo', blockName: 'MVCC',
        question: 'undo log 有哪些作用？', cardType: 'enumeration' as const, frequency: 'high' as const,
        keyPoints: [], detail: '',
      }}
      variant={base.variant} submission={base.submission} offline={false} result={pass} />,
  )
  const link = screen.getByRole('link', { name: /回学习页/ })
  expect(link).toHaveAttribute('href', '/learn?block=mysql/mvcc-undo')
})

test('错勾溯源：variant 带 distractorOrigins → 显示真实来源题面', () => {
  render(
    <DrillFeedback
      card={base.card}
      variant={{
        ...base.variant,
        distractorOrigins: { 1: { cardId: 'c2', blockId: 'b1', question: 'RC 和 RR 的区别？' } },
      }}
      submission={base.submission} offline={false}
      result={{ score: { num: 2, den: 3 }, remainingPlan: [], replanned: false, feedback: { correctChecked: 2, wrongChecked: 1, missed: 1 } } as never} />,
  )
  const opts = screen.getAllByTestId('option')
  expect(opts[1]!.textContent).toContain('属于《RC 和 RR 的区别？》')   // 下标 1 是错勾的干扰项
})

test('错勾溯源三级降级：mc 优先「常见误解」→ 池干扰项「属于《…》」→ 旧缓存通用文案', () => {
  // 下标 3 有 misconceptionWhy、下标 5 有 distractorOrigins、下标 7 两者皆无（旧缓存形态）
  render(
    <DrillFeedback
      card={base.card}
      variant={{
        optionTexts: ['对1', '对2', '对3', '误解项', 'x', '池干扰项', 'x', '裸干扰项', 'x'],
        correctIndices: [0, 1, 2],
        distractorKeyPointIds: ['kp-1'],
        misconceptionIds: ['mc-0'],
        misconceptionWhy: { 3: 'W-m0' },
        distractorOrigins: { 5: { cardId: 'c2', blockId: 'b1', question: '某题面' } },
      }}
      submission={{ submissionId: 's-mc', cardId: 'c1', reviewedAtMs: 0, kind: 'selection' as const, selected: [3, 5, 7] }}
      offline={false}
      result={{ score: { num: 0, den: 3 }, remainingPlan: [], replanned: false,
        feedback: { correctChecked: 0, wrongChecked: 3, missed: 3 } } as never}
    />,
  )
  const opts = screen.getAllByTestId('option')
  expect(opts[3]!.textContent).toContain('常见误解：W-m0')        // ① 专属错误项：它不属于任何题，本身就是错的 → why 优先
  expect(opts[5]!.textContent).toContain('属于《某题面》')         // ② 池干扰项 → 真实来源题面
  expect(opts[7]!.textContent).toContain('属于本大类的另一道题')   // ③ 旧缓存两者皆缺 → 通用文案
  // 染色/计数同构：correct:false 不分来源——mc、池、无溯源三者同为错勾红、一并记 3 条
  expect(opts[3]).toHaveAttribute('data-state', 'wrong')
  expect(opts[5]).toHaveAttribute('data-state', 'wrong')
  expect(opts[7]).toHaveAttribute('data-state', 'wrong')
  expect(screen.getByText(/错勾.*3/)).toBeInTheDocument()
})

test('错勾溯源：旧缓存 variant 无 origins → 回退通用文案（不炸）', () => {
  render(<DrillFeedback {...base} offline={false}
    result={{ score: { num: 2, den: 3 }, remainingPlan: [], replanned: false, feedback: { correctChecked: 2, wrongChecked: 1, missed: 1 } } as never} />)
  const opts = screen.getAllByTestId('option')
  expect(opts[1]!.textContent).toContain('属于本大类的另一道题')
})

test('sequence 收束：按 canonical 正确顺序列要点', () => {
  render(<DrillFeedback {...seqBase} offline={false}
    result={{ score: { num: 1, den: 2 }, remainingPlan: [], replanned: false, feedback: { correctChecked: 2, wrongChecked: 2, missed: 0 } } as never} />)
  const items = screen.getByTestId('takeaway').querySelectorAll('li')
  // 序号与文本同渲染（「1」「B」相邻）→ canonical 顺序 B,A,D,C
  expect(Array.from(items).map(li => li.textContent)).toEqual(['1B', '2A', '3D', '4C'])
})
