import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpgradeView } from '../../src/app/upgrade/UpgradeView.js'

const api = (postRedeem: unknown) => ({ postRedeem } as never)

test('保留价格与买断文案；说明现阶段凭邀请码解锁（在线支付即将上线）', () => {
  render(<UpgradeView priceCents={12900} plan="free" api={api(vi.fn())} />)
  expect(screen.getByText(/¥\s*129/)).toBeInTheDocument()
  expect(screen.getByText(/一次性买断/)).toBeInTheDocument()
  expect(screen.getByText(/现阶段凭邀请码解锁/)).toBeInTheDocument()
})

test('假支付按钮已删：不再出现「立即解锁全部题库」', () => {
  render(<UpgradeView priceCents={12900} plan="free" api={api(vi.fn())} />)
  expect(screen.queryByRole('button', { name: '立即解锁全部题库' })).not.toBeInTheDocument()
})

test('free 用户：输码点「用邀请码解锁」→ postRedeem(code)，成功出已解锁态', async () => {
  const u = userEvent.setup()
  const postRedeem = vi.fn(async () => ({ outcome: 'fulfilled' as const }))
  render(<UpgradeView priceCents={12900} plan="free" api={api(postRedeem)} />)
  await u.type(screen.getByLabelText(/邀请码/), 'ABCD-EFGH-JKMN-PQRS')
  await u.click(screen.getByRole('button', { name: /用邀请码解锁/ }))
  expect(postRedeem).toHaveBeenCalledWith('ABCD-EFGH-JKMN-PQRS')
  expect(await screen.findByText(/已解锁全部题库/)).toBeInTheDocument()
})

test('already：原本就已解锁 → 同样落已解锁态，不报错', async () => {
  const u = userEvent.setup()
  const postRedeem = vi.fn(async () => ({ outcome: 'already' as const }))
  render(<UpgradeView priceCents={12900} plan="free" api={api(postRedeem)} />)
  await u.type(screen.getByLabelText(/邀请码/), 'ABCD-EFGH-JKMN-PQRS')
  await u.click(screen.getByRole('button', { name: /用邀请码解锁/ }))
  expect(await screen.findByText(/已解锁全部题库/)).toBeInTheDocument()
})

test('无效码：role=alert 透传服务端中文消息，可重试', async () => {
  const u = userEvent.setup()
  const postRedeem = vi.fn(async () => { throw new Error('邀请码无效或已被使用') })
  render(<UpgradeView priceCents={12900} plan="free" api={api(postRedeem)} />)
  await u.type(screen.getByLabelText(/邀请码/), 'ZZZZ-ZZZZ-ZZZZ-ZZZZ')
  await u.click(screen.getByRole('button', { name: /用邀请码解锁/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('邀请码无效或已被使用')
  // 可重试：输入框与按钮仍在
  expect(screen.getByRole('button', { name: /用邀请码解锁/ })).toBeEnabled()
})

test('匿名（plan=null）：点击兑换先提示登录，不发请求', async () => {
  const u = userEvent.setup()
  const postRedeem = vi.fn()
  render(<UpgradeView priceCents={12900} plan={null} api={api(postRedeem)} />)
  await u.type(screen.getByLabelText(/邀请码/), 'ABCD-EFGH-JKMN-PQRS')
  await u.click(screen.getByRole('button', { name: /用邀请码解锁/ }))
  expect(postRedeem).not.toHaveBeenCalled()
  expect(await screen.findByRole('alert')).toHaveTextContent('先登录')
})

test('已 paid 用户：直接显示已解锁态，不出输入框', () => {
  render(<UpgradeView priceCents={12900} plan="paid" api={api(vi.fn())} />)
  expect(screen.getByText(/已解锁全部题库/)).toBeInTheDocument()
  expect(screen.queryByLabelText(/邀请码/)).not.toBeInTheDocument()
})
