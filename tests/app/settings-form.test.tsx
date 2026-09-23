import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsForm } from '../../src/app/settings/SettingsForm.js'

const view = {
  readyByDate: '2026-11-01', dailyCapacity: 45, plan: 'free',
  blocks: [
    { blockId: 'b1', blockName: 'MySQL', cardCount: 23, selected: true },
    { blockId: 'b2', blockName: 'Redis', cardCount: 18, selected: false },
    { blockId: 'b3', blockName: 'JVM', cardCount: 30, selected: false },
  ],
} as never

function mkApi() {
  return { postSettings: vi.fn(async () => ({ replanned: 12 })), postBlocks: vi.fn(async () => ({ paused: 0, added: 1 })) }
}

test('预填当前就绪日与容量、块勾选态', () => {
  render(<SettingsForm view={view} api={mkApi() as never} />)
  expect(screen.getByLabelText(/就绪日/)).toHaveValue('2026-11-01')
  expect(screen.getByLabelText(/每日容量|容量/)).toHaveValue(45)
  expect(screen.getByRole('checkbox', { name: /MySQL/ })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: /Redis/ })).not.toBeChecked()
})

test('免费层勾选超过 2 块 → 提交禁用并提示', async () => {
  const u = userEvent.setup()
  render(<SettingsForm view={view} api={mkApi() as never} />)
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))  // 2 块，仍可
  await u.click(screen.getByRole('checkbox', { name: /JVM/ }))    // 3 块，超限
  expect(screen.getByRole('button', { name: /保存/ })).toBeDisabled()
  expect(screen.getByText(/最多.*2.*块/)).toBeInTheDocument()
})

test('保存：调 postSettings + postBlocks，显示重排条数', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  render(<SettingsForm view={view} api={api as never} />)
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(api.postSettings).toHaveBeenCalledWith({ readyByDate: '2026-11-01', dailyCapacity: 45 })
  expect(api.postBlocks).toHaveBeenCalledWith({ blockIds: ['b1'] })
  expect(await screen.findByText(/重排.*12/)).toBeInTheDocument()
})
