import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpgradeView } from '../../src/app/upgrade/UpgradeView.js'

const api = (postRedeem: unknown) => ({ postRedeem } as never)

test('价格与期限文案：¥29 / 30 天通行证，不自动续费（不再是一次性买断）', () => {
  render(<UpgradeView priceCents={2900} access="free" daysLeft={null} graceUntil={null} api={api(vi.fn())} />)
  expect(screen.getByText(/¥\s*29/)).toBeInTheDocument()
  // 期限与「不自动续费」都要写明白，且不能再出现买断措辞
  expect(screen.getByText(/30 天通行证 · 全部知识块 · 不自动续费/)).toBeInTheDocument()
  expect(screen.queryByText(/一次性买断/)).not.toBeInTheDocument()
})

test('假支付按钮已删：不再出现「立即解锁全部题库」', () => {
  render(<UpgradeView priceCents={2900} access="free" daysLeft={null} graceUntil={null} api={api(vi.fn())} />)
  expect(screen.queryByRole('button', { name: '立即解锁全部题库' })).not.toBeInTheDocument()
})

test('有效期内：显示剩余天数与「已排的题会跑完」的承诺', () => {
  render(<UpgradeView priceCents={2900} access="paid" daysLeft={12} graceUntil={null} api={api(vi.fn())} />)
  expect(screen.getByText(/还剩 12 天/)).toBeInTheDocument()
  expect(screen.getByText(/已排的题会跑完/)).toBeInTheDocument()
  // 有效期内**不**说「已解锁全部题库」这类永久措辞
  expect(screen.queryByText(/已解锁全部题库/)).not.toBeInTheDocument()
})

test('有效期内可提前续期：仍出输码框（叠加，不谎称「不可续」）', () => {
  render(<UpgradeView priceCents={2900} access="paid" daysLeft={12} graceUntil={null} api={api(vi.fn())} />)
  expect(screen.getByText(/再续 30 天/)).toBeInTheDocument()
  expect(screen.getByLabelText(/邀请码/)).toBeInTheDocument()
})

test('宽限期内：说明通行证已到期并给出宽限截止，可续期，不谎称「已解锁全部题库」', () => {
  render(<UpgradeView priceCents={2900} access="grace" daysLeft={null} graceUntil="2026-10-16" api={api(vi.fn())} />)
  expect(screen.getByText(/2026-10-16/)).toBeInTheDocument()
  expect(screen.getByText(/通行证已到期/)).toBeInTheDocument()
  expect(screen.getByLabelText(/邀请码/)).toBeInTheDocument()
  expect(screen.queryByText(/已解锁全部题库/)).not.toBeInTheDocument()
})

test('free 用户：输码点「用邀请码解锁」→ postRedeem(code)，成功出解锁态', async () => {
  const u = userEvent.setup()
  const postRedeem = vi.fn(async () => ({ outcome: 'fulfilled' as const }))
  render(<UpgradeView priceCents={2900} access="free" daysLeft={null} graceUntil={null} api={api(postRedeem)} />)
  await u.type(screen.getByLabelText(/邀请码/), 'ABCD-EFGH-JKMN-PQRS')
  await u.click(screen.getByRole('button', { name: /用邀请码解锁/ }))
  expect(postRedeem).toHaveBeenCalledWith('ABCD-EFGH-JKMN-PQRS')
  expect(await screen.findByTestId('unlocked-badge')).toBeInTheDocument()
})

test('无效码：role=alert 透传服务端中文消息，可重试', async () => {
  const u = userEvent.setup()
  const postRedeem = vi.fn(async () => { throw new Error('邀请码无效或已被使用') })
  render(<UpgradeView priceCents={2900} access="free" daysLeft={null} graceUntil={null} api={api(postRedeem)} />)
  await u.type(screen.getByLabelText(/邀请码/), 'ZZZZ-ZZZZ-ZZZZ-ZZZZ')
  await u.click(screen.getByRole('button', { name: /用邀请码解锁/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('邀请码无效或已被使用')
  // 可重试：输入框与按钮仍在
  expect(screen.getByRole('button', { name: /用邀请码解锁/ })).toBeEnabled()
})

test('匿名（access=null）：点击兑换先提示登录，不发请求', async () => {
  const u = userEvent.setup()
  const postRedeem = vi.fn()
  render(<UpgradeView priceCents={2900} access={null} daysLeft={null} graceUntil={null} api={api(postRedeem)} />)
  await u.type(screen.getByLabelText(/邀请码/), 'ABCD-EFGH-JKMN-PQRS')
  await u.click(screen.getByRole('button', { name: /用邀请码解锁/ }))
  expect(postRedeem).not.toHaveBeenCalled()
  expect(await screen.findByRole('alert')).toHaveTextContent('先登录')
})

test('解锁态引导去设置勾题（兑换会清掉原勾选，所以必须引导重勾，别写成「保留」）', () => {
  render(<UpgradeView priceCents={2900} access="free" daysLeft={null} graceUntil={null} api={api(vi.fn())} />)
  render(<UpgradeView priceCents={2900} access="paid" daysLeft={5} graceUntil={null} api={api(vi.fn())} />)
  expect(screen.getAllByTestId('goto-settings')[0]).toHaveAttribute('href', '/settings')
  expect(screen.getAllByText(/每日排期要刷哪些，去设置一键勾上/)[0]).toBeInTheDocument()
})

test('页脚保留「排期与刷题功能永久免费」——免费的从来是功能，不是题量', () => {
  render(<UpgradeView priceCents={2900} access="free" daysLeft={null} graceUntil={null} api={api(vi.fn())} />)
  expect(screen.getByText(/排期与刷题功能永久免费/)).toBeInTheDocument()
})
