import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpgradeView } from '../../src/app/upgrade/UpgradeView.js'

test('展示价格与一次性买断文案 + 解锁按钮', () => {
  render(<UpgradeView priceCents={12900} api={{ postCreateOrder: vi.fn() } as never} />)
  expect(screen.getByText(/¥\s*129/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /解锁/ })).toBeInTheDocument()
})

test('点击解锁调 postCreateOrder', async () => {
  const u = userEvent.setup()
  const postCreateOrder = vi.fn(async () => ({ orderId: 'o1', amountCents: 12900, payParams: {} }))
  render(<UpgradeView priceCents={12900} api={{ postCreateOrder } as never} />)
  await u.click(screen.getByRole('button', { name: /解锁/ }))
  expect(postCreateOrder).toHaveBeenCalledOnce()
})
