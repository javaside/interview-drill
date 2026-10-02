import { render, screen } from '@testing-library/react'
import { getServerSession } from 'next-auth'
import { loadSettings } from '../../src/server/db/adapters.js'
import UpgradePage from '../../src/app/upgrade/page.js'

/**
 * 解锁页服务端壳（三态 → props）。这层是**剩余天数唯一的计算处**，也是
 * 「匿名可看、兑换才要身份」的分叉点，所以单独测。
 */
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('../../src/server/db/client.js', () => ({ getDb: () => ({}) }))
vi.mock('../../src/server/auth-config.js', () => ({ authOptions: {} }))
vi.mock('../../src/server/db/adapters.js', async importOriginal => ({
  ...(await importOriginal<object>()),
  loadSettings: vi.fn(),
}))

const DAY_MS = 86400_000
const signedIn = () => vi.mocked(getServerSession).mockResolvedValue({ userId: 'u1' } as never)

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  readyByDate: null, dailyCapacity: 45, timezone: 'Asia/Shanghai',
  plan: 'paid', freeBlockIds: [], paidUntil: null, graceUntil: null,
  graceBlockIds: [], trackId: null,
  ...over,
})

test('匿名：access=null，照常展示价格与输码框（浏览零门槛）', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null as never)
  render(await UpgradePage())
  expect(screen.getByText(/¥\s*29/)).toBeInTheDocument()
  expect(screen.getByLabelText(/邀请码/)).toBeInTheDocument()
})

test('有效期内：剩余天数向上取整且至少 1 天（还剩 3 小时显示 1 天，不是 0 天）', async () => {
  signedIn()
  vi.mocked(loadSettings).mockResolvedValue(row({
    paidUntil: new Date(Date.now() + 12 * DAY_MS + 3 * 3600_000),
  }) as never)
  render(await UpgradePage())
  expect(screen.getByText(/还剩 13 天/)).toBeInTheDocument()

  vi.mocked(loadSettings).mockResolvedValue(row({
    paidUntil: new Date(Date.now() + 3 * 3600_000),   // 不足一天
  }) as never)
  render(await UpgradePage())
  expect(screen.getByText(/还剩 1 天/)).toBeInTheDocument()
})

test('宽限期：如实显示已到期与宽限截止日，且不给剩余天数（已过期不该有）', async () => {
  signedIn()
  vi.mocked(loadSettings).mockResolvedValue(row({
    paidUntil: new Date(Date.now() - DAY_MS),
    graceUntil: '2026-10-16',
    graceBlockIds: ['b1'],
    freeBlockIds: ['b1'],
  }) as never)
  render(await UpgradePage())
  expect(screen.getByText(/通行证已到期/)).toBeInTheDocument()
  expect(screen.getByText(/2026-10-16/)).toBeInTheDocument()
  expect(screen.queryByText(/还剩/)).not.toBeInTheDocument()
  expect(screen.queryByText(/已解锁全部题库/)).not.toBeInTheDocument()
})

test('从未付费：走解锁分支，不显示剩余天数', async () => {
  signedIn()
  vi.mocked(loadSettings).mockResolvedValue(row({ plan: 'free', paidUntil: null }) as never)
  render(await UpgradePage())
  expect(screen.getByRole('button', { name: /用邀请码解锁/ })).toBeInTheDocument()
  expect(screen.queryByText(/还剩/)).not.toBeInTheDocument()
})

test('传了 nowMs 给 loadSettings：惰性结算必须在本页也生效', async () => {
  signedIn()
  vi.mocked(loadSettings).mockResolvedValue(row({ paidUntil: new Date(Date.now() + DAY_MS) }) as never)
  await UpgradePage()
  expect(vi.mocked(loadSettings).mock.calls[0]![2]).toBeTypeOf('number')
})
