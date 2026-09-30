import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BackstageView } from '../../src/app/backstage/BackstageView.js'

const api = (over: Partial<Record<'fetchInviteCodes' | 'postMintInvites', unknown>>) => over as never

const ledger = [
  { id: 'ic1', note: '内测第一批', createdAt: '2026-09-30T10:00:00Z', usedBy: 'u2', usedAt: '2026-09-30T11:00:00Z' },
  { id: 'ic2', note: '朋友', createdAt: '2026-09-30T12:00:00Z', usedBy: null, usedAt: null },
]

test('台账加载：备注 + 状态（未用/已兑换）区分展示', async () => {
  render(<BackstageView api={api({
    fetchInviteCodes: vi.fn(async () => ledger),
    postMintInvites: vi.fn(),
  })} />)
  await waitFor(() => expect(screen.getByText('内测第一批')).toBeInTheDocument())
  expect(screen.getByText(/已兑换/)).toBeInTheDocument()
  expect(screen.getByText('未用')).toBeInTheDocument()
})

test('铸码：数量+备注 → postMintInvites(n, note)，明文码逐张显示带复制按钮', async () => {
  const u = userEvent.setup()
  const postMintInvites = vi.fn(async () => ({ codes: ['ABCD-EFGH-JKMN-PQRS', 'ZZZZ-ZZZZ-ZZZZ-ZZZZ'] }))
  render(<BackstageView api={api({
    fetchInviteCodes: vi.fn(async () => []),
    postMintInvites,
  })} />)
  await u.clear(screen.getByLabelText(/数量/))
  await u.type(screen.getByLabelText(/数量/), '2')
  await u.type(screen.getByLabelText(/备注/), '内测')
  await u.click(screen.getByRole('button', { name: /生成/ }))
  expect(postMintInvites).toHaveBeenCalledWith(2, '内测')
  expect(await screen.findByText('ABCD-EFGH-JKMN-PQRS')).toBeInTheDocument()
  expect(screen.getByText('ZZZZ-ZZZZ-ZZZZ-ZZZZ')).toBeInTheDocument()
  // 每张码一个复制按钮
  expect(screen.getAllByRole('button', { name: /复制/ })).toHaveLength(2)
  // 明文只此一次的提醒在场
  expect(screen.getByText(/仅此一次/)).toBeInTheDocument()
})

test('生成失败：role=alert 透传服务端消息', async () => {
  const u = userEvent.setup()
  render(<BackstageView api={api({
    fetchInviteCodes: vi.fn(async () => []),
    postMintInvites: vi.fn(async () => { throw new Error('铸码数量必须是 ≥1 的整数，收到 0') }),
  })} />)
  await u.type(screen.getByLabelText(/数量/), '0')
  await u.click(screen.getByRole('button', { name: /生成/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('铸码数量必须是 ≥1 的整数')
})
