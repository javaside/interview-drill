import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminCardQA } from '../../src/app/AdminCardQA.js'
import { LearnView } from '../../src/app/learn/LearnView.js'
import type { LearnCard } from '../../src/app/learn/LearnView.js'
import type { Api } from '../../src/client/api.js'

/**
 * 管理员审题组件：流式问答（注入 api 假实现）→ 讨论完成后「确认有问题，提交报告」
 * 收口——报告只带 role/content（reasoning 剥掉）、结论必填、成功展示报告 id。
 * LearnView 的 admin 视角渲染开关也在本文件钉住。
 */

type AdminApi = Pick<Api, 'postAdminQaStream' | 'postCardReport'>

function fakeApi(over: Partial<Record<keyof AdminApi, AdminApi[keyof AdminApi]>> = {}): AdminApi {
  return {
    postAdminQaStream: vi.fn(async (_cardId, _history, handlers) => { handlers.onDelta('AI 审题意见') }),
    postCardReport: vi.fn(async () => ({ id: '01REPORT' })),
    ...over,
  } as AdminApi
}

async function askOnce(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: /审题（管理员）/ }))
  await user.type(screen.getByRole('textbox', { name: /向 AI 提审题意见/ }), '这条要点对吗')
  await user.click(screen.getByRole('button', { name: '提问' }))
  await waitFor(() => expect(screen.getByText(/AI 审题意见/)).toBeInTheDocument())
}

test('讨论流：打 /api/admin/qa（注入 api），回答上屏，历史随第二轮携带', async () => {
  const user = userEvent.setup()
  const api = fakeApi()
  render(<AdminCardQA cardId="c1" api={api} />)
  await askOnce(user)

  expect(api.postAdminQaStream).toHaveBeenCalledWith('c1',
    [{ role: 'user', content: '这条要点对吗' }], expect.anything(), expect.anything())

  await user.type(screen.getByRole('textbox', { name: /向 AI 提审题意见/ }), '再确认下')
  await user.click(screen.getByRole('button', { name: '提问' }))
  await waitFor(() => expect(api.postAdminQaStream).toHaveBeenCalledTimes(2))
  const history = vi.mocked(api.postAdminQaStream).mock.calls[1]![1]
  expect(history).toEqual([
    { role: 'user', content: '这条要点对吗' },
    { role: 'assistant', content: 'AI 审题意见' },
    { role: 'user', content: '再确认下' },
  ])
})

test('收口：聊完后提交报告——turns 剥 reasoning 只带 role/content，成功展示 id 与未处理计数', async () => {
  const user = userEvent.setup()
  const api = fakeApi({
    postAdminQaStream: vi.fn(async (_c, _h, handlers) => {
      handlers.onReasoning?.('思考过程不该进报告')
      handlers.onDelta('AI 审题意见')
    }),
  })
  render(<AdminCardQA cardId="c1" openReports={1} api={api} />)
  // 折叠态 chip 已提示防重复（文本被 span 分隔，用 toHaveTextContent 跨元素断言）
  expect(screen.getByRole('button', { name: /审题（管理员）/ })).toHaveTextContent('1 条未处理')
  await askOnce(user)

  await user.type(screen.getByRole('textbox', { name: /问题报告的结论/ }), 'kp-2 表述歧义')
  await user.click(screen.getByRole('button', { name: /提交报告/ }))

  await waitFor(() => expect(screen.getByTestId('report-submitted')).toHaveTextContent('01REPORT'))
  expect(api.postCardReport).toHaveBeenCalledWith('c1', 'kp-2 表述歧义', [
    { role: 'user', content: '这条要点对吗' },
    { role: 'assistant', content: 'AI 审题意见' },   // 没有 reasoning 字段
  ])
  // 提交成功后未处理计数 +1（面板内的跨元素文本），且表单收起
  expect(screen.getByTestId('admin-qa-c1')).toHaveTextContent('已有 2 条未处理报告')
})

test('提交被服务端拒绝（400 + 中文 error）→ role=alert，表单保留可重试', async () => {
  const user = userEvent.setup()
  const api = fakeApi({
    postCardReport: vi.fn(async () => { throw new Error('写一句结论再提交——台账和导出文件靠它定位问题') }),
  })
  render(<AdminCardQA cardId="c1" api={api} />)
  await askOnce(user)

  await user.type(screen.getByRole('textbox', { name: /问题报告的结论/ }), '结论')
  await user.click(screen.getByRole('button', { name: /提交报告/ }))

  await waitFor(() => expect(screen.getAllByRole('alert').some(a => a.textContent?.includes('写一句结论再提交'))).toBe(true))
  expect(screen.getByRole('textbox', { name: /问题报告的结论/ })).toHaveValue('结论')
})

test('LearnView admin 开关：admin 才渲染审题框，普通用户零痕迹', () => {
  const cards: LearnCard[] = [
    { cardId: 'c1', question: 'q1', frequency: 'high', detail: 'd' },
  ]
  const { rerender } = render(<LearnView blockName="B" cards={cards} blockId="b1" />)
  expect(screen.queryByRole('button', { name: /审题（管理员）/ })).not.toBeInTheDocument()

  rerender(<LearnView blockName="B" cards={cards} blockId="b1" admin reportsByCard={{ c1: 2 }} />)
  const trigger = screen.getByRole('button', { name: /审题（管理员）/ })
  expect(trigger).toHaveTextContent('2 条未处理')
})
