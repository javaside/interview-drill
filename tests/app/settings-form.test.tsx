import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsForm } from '../../src/app/settings/SettingsForm.js'
import type { LocalDate } from '../../src/lib/scheduler/date.js'

const baseView = {
  readyByDate: '2026-11-01', dailyCapacity: 45, plan: 'free',
  trackId: null,
  tracks: [{ id: 'java-backend', name: 'Java 后端', blockIds: ['b1', 'b2', 'b3'] }],
  blocks: [
    { blockId: 'b1', blockName: 'MySQL', category: 'mysql', cardCount: 23, selected: true },
    { blockId: 'b2', blockName: 'Redis', category: 'mysql', cardCount: 18, selected: false },
    { blockId: 'b3', blockName: 'JVM', category: 'jvm', cardCount: 30, selected: false },
  ],
}
const view = baseView as never

type SettingsResult = { replanned: number; changed: boolean }
type CramResult = { crammed: number; excluded: number; overloaded: boolean; readyByDate: LocalDate | null }

function mkApi() {
  return {
    postSettings: vi.fn(async (): Promise<SettingsResult> => ({ replanned: 12, changed: true })),
    postBlocks: vi.fn(async () => ({ paused: 0, added: 1 })),
  }
}
function mkCramApi() {
  return {
    ...mkApi(),
    postCram: vi.fn(async (): Promise<CramResult> => ({ crammed: 5, excluded: 0, overloaded: false, readyByDate: null })),
  }
}

test('预填当前就绪日与容量、块勾选态', () => {
  render(<SettingsForm view={view} api={mkApi() as never} />)
  expect(screen.getByLabelText(/目标日期/)).toHaveValue('2026-11-01')
  expect(screen.getByLabelText(/每天刷几题/)).toHaveValue(45)
  expect(screen.getByRole('checkbox', { name: /MySQL/ })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: /Redis/ })).not.toBeChecked()
  // sticky 无；保存条初始态：无变更时明确告知「已保存」
  expect(screen.getByText('已保存')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '保存设置' })).toBeEnabled()
})

test('块列表按大类分组展示（组标题 + 各组内块）', () => {
  render(<SettingsForm view={view} api={mkApi() as never} />)
  const mysql = screen.getByRole('heading', { name: /mysql/i })
  const jvm = screen.getByRole('heading', { name: /jvm/i })
  expect(mysql).toBeInTheDocument()
  expect(jvm).toBeInTheDocument()
  // mysql 组内两块、jvm 组内一块（岗位 chip 不算块列表行）
  expect(mysql.nextElementSibling?.querySelectorAll('input[type=checkbox]')).toHaveLength(2)
  expect(jvm.nextElementSibling?.querySelectorAll('input[type=checkbox]')).toHaveLength(1)
})

test('免费墙：勾满 2 块当场提示；点第 3 块不勾上、提示弹在被点行后；取消一块即可再勾', async () => {
  const u = userEvent.setup()
  render(<SettingsForm view={view} api={mkApi() as never} />)
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))   // 2/2 满——提示出现在刚勾的行后
  const redisSection = screen.getByRole('checkbox', { name: /Redis/ }).closest('section')
  expect(redisSection).toContainElement(screen.getByTestId('inline-cap-status'))
  // 点第 3 块（另一分组）：不勾上，但提示当场移到被点行的分组里——任何点击必有回应
  const jvm = screen.getByRole('checkbox', { name: /JVM/ })
  await u.click(jvm)
  expect(jvm).not.toBeChecked()
  const jvmSection = jvm.closest('section')
  expect(jvmSection).toContainElement(screen.getByTestId('inline-cap-status'))
  expect(screen.getByTestId('free-cap-status')).toHaveTextContent(/已选满，取消一个可更换/)
  // 取消一块腾出名额 → JVM 立即可勾
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))
  await u.click(jvm)
  expect(jvm).toBeChecked()
})

// ---------- 岗位多选（2026-09-30 第六轮）：点 chip 立即生效；第七轮起整批动作自动保存 ----------

test('岗位 chip 立即生效且自动保存：点一个 = 替换并落库；再点一个 = 并集落库，无需手动保存', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  const v = {
    ...baseView, plan: 'paid',
    tracks: [
      { id: 'java-backend', name: 'Java 后端', blockIds: ['b1', 'b3'] },
      { id: 'agent-dev', name: 'Agent 开发', blockIds: ['b2'] },
    ],
  } as never
  render(<SettingsForm view={v} api={api as never} />)
  // 点一个岗位：b1/b3 勾上，b2（其他岗位）当场取消——不等任何按钮
  await u.click(screen.getByRole('checkbox', { name: /Java 后端/ }))
  expect(screen.getByTestId('selected-count')).toHaveTextContent('已勾 2 个')
  expect(screen.getByRole('checkbox', { name: /Redis/ })).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: /JVM/ })).toBeChecked()
  expect(screen.getByTestId('bulk-note')).toHaveTextContent('已勾 2 块 · 53 题（Java 后端）——已自动保存')
  // 再点第二个岗位：并集叠加（连点排队，末次生效）
  await u.click(screen.getByRole('checkbox', { name: /Agent 开发/ }))
  expect(screen.getByTestId('selected-count')).toHaveTextContent('已勾 3 个')
  expect(screen.getByTestId('bulk-note')).toHaveTextContent('已勾 3 块 · 71 题（Java 后端、Agent 开发）——已自动保存')
  // 等保存落定：最后一次自动保存提交并集，基线更新后无未保存提示
  await screen.findByText(/重排.*12/)
  expect(api.postBlocks).toHaveBeenLastCalledWith({ blockIds: ['b1', 'b3', 'b2'] })   // 岗位列表顺序的并集
  expect(screen.queryByTestId('dirty-hint')).not.toBeInTheDocument()
  // 付费语义说明在场
  expect(screen.getByText(/勾了的题目进首页每日排期/)).toBeInTheDocument()
})

test('逐块手动勾选不自动保存：出「有未保存的变更」，点保存才提交', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  render(<SettingsForm view={view} api={api as never} />)
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))
  expect(api.postBlocks).not.toHaveBeenCalled()   // 手动逐块勾 ≠ 整批动作，不自动保存
  expect(screen.getByTestId('dirty-hint')).toHaveTextContent('有未保存的变更')
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(api.postBlocks).toHaveBeenCalledWith({ blockIds: ['b1', 'b2'] })
})

test('岗位 chip 点掉一个 = 剩余并集；全部点掉 = 没勾任何题目（各步自动保存）', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  const v = {
    ...baseView, plan: 'paid',
    tracks: [
      { id: 'java-backend', name: 'Java 后端', blockIds: ['b1', 'b3'] },
      { id: 'agent-dev', name: 'Agent 开发', blockIds: ['b2'] },
    ],
  } as never
  render(<SettingsForm view={v} api={api as never} />)
  await u.click(screen.getByRole('checkbox', { name: /Java 后端/ }))
  await u.click(screen.getByRole('checkbox', { name: /Agent 开发/ }))
  await screen.findByText(/重排.*12/)   // 等连点队列排空（末次并集已落库）
  expect(api.postBlocks).toHaveBeenLastCalledWith({ blockIds: ['b1', 'b3', 'b2'] })
  // 点掉 Java 后端 → 只剩 Agent 开发的 b2
  await u.click(screen.getByRole('checkbox', { name: /Java 后端/ }))
  expect(screen.getByTestId('selected-count')).toHaveTextContent('已勾 1 个')
  expect(screen.getByRole('checkbox', { name: /Redis/ })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: /MySQL/ })).not.toBeChecked()
  // 全部点掉 → 没勾任何题目（反馈明说后果，自动保存）
  await u.click(screen.getByRole('checkbox', { name: /Agent 开发/ }))
  expect(screen.getByTestId('selected-count')).toHaveTextContent('已勾 0 个')
  expect(screen.getByTestId('bulk-note')).toHaveTextContent('已取消全部岗位——没勾任何题目，已自动保存，首页不出新题')
})

test('免费：点岗位取并集前 2 块自动保存（免费名额内），反馈给升级出路', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  render(<SettingsForm view={view} api={api as never} />)   // 岗位含 b1/b2/b3
  await u.click(screen.getByRole('checkbox', { name: /Java 后端/ }))
  expect(screen.getByTestId('selected-count')).toHaveTextContent('已勾 2 个')
  const note = screen.getByTestId('bulk-note')
  expect(note).toHaveTextContent('已勾 2 块 · 41 题（免费名额内，已自动保存）')
  expect(note).toHaveTextContent('升级解锁所选岗位全部 3 块')
  expect(within(note).getByRole('link', { name: /升级解锁/ })).toHaveAttribute('href', '/upgrade')
  expect(screen.getByRole('checkbox', { name: /MySQL/ })).toBeChecked()     // 并集顺序第 1
  expect(screen.getByRole('checkbox', { name: /Redis/ })).toBeChecked()     // 第 2
  expect(screen.getByRole('checkbox', { name: /JVM/ })).not.toBeChecked()   // 名额外不勾
  expect(api.postBlocks).toHaveBeenCalledWith({ blockIds: ['b1', 'b2'] })  // 截断后的集自动落库
})

test('当前勾选集恰为某岗位块集时，该岗位 chip 预勾（现在刷的是哪个岗位一眼可见）', () => {
  const v = {
    ...baseView,
    tracks: [
      { id: 'java-backend', name: 'Java 后端', blockIds: ['b1', 'b3'] },
      { id: 'agent-dev', name: 'Agent 开发', blockIds: ['b2'] },
    ],
    blocks: baseView.blocks.map(b => ({ ...b, selected: b.blockId !== 'b2' })),   // 恰为 java-backend
  } as never
  render(<SettingsForm view={v} api={mkApi() as never} />)
  expect(screen.getByRole('checkbox', { name: /Java 后端/ })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: /Agent 开发/ })).not.toBeChecked()
})

test('付费：全选按钮同样自动保存；免费不提供', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  const v = { ...baseView, plan: 'paid' } as never
  const { unmount } = render(<SettingsForm view={v} api={api as never} />)
  await u.click(screen.getByRole('button', { name: '全选（3 块）' }))
  expect(screen.getByTestId('selected-count')).toHaveTextContent('已勾 3 个')
  expect(screen.getByTestId('bulk-note')).toHaveTextContent('已勾全部 3 块 · 71 题——已自动保存')
  await screen.findByText(/重排.*12/)
  expect(api.postBlocks).toHaveBeenLastCalledWith({ blockIds: ['b1', 'b2', 'b3'] })
  unmount()
  render(<SettingsForm view={view} api={mkApi() as never} />)   // 免费视图
  expect(screen.queryByRole('button', { name: /全选/ })).not.toBeInTheDocument()
})

test('手动逐块勾选清除岗位反馈（反馈不再代表当前事实）', async () => {
  const u = userEvent.setup()
  render(<SettingsForm view={view} api={mkApi() as never} />)
  await u.click(screen.getByRole('checkbox', { name: /Java 后端/ }))
  expect(screen.getByTestId('bulk-note')).toBeInTheDocument()
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))   // 手动取消（名额 2/2 → 1/2）
  expect(screen.queryByTestId('bulk-note')).not.toBeInTheDocument()
  expect(screen.getByTestId('selected-count')).toHaveTextContent('已勾 1 个')
})

test('保存：调 postSettings + postBlocks，显示重排条数', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  render(<SettingsForm view={view} api={api as never} />)
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))   // 有块集变更才发 postBlocks
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(api.postSettings).toHaveBeenCalledWith({ readyByDate: '2026-11-01', dailyCapacity: 45 })
  expect(api.postBlocks).toHaveBeenCalledWith({ blockIds: ['b1', 'b2'] })
  expect(await screen.findByText(/重排.*12/)).toBeInTheDocument()
})

test('无块集变更时保存跳过 postBlocks（省一次请求，消掉第二步假错误面）', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  api.postSettings.mockResolvedValueOnce({ replanned: 0, changed: false })
  render(<SettingsForm view={view} api={api as never} />)
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(api.postSettings).toHaveBeenCalledTimes(1)
  expect(api.postBlocks).not.toHaveBeenCalled()
  expect(await screen.findByText(/设置未变化/)).toBeInTheDocument()
})

test('岗位无设置项：无 radio、无推荐徽标——岗位只以多选勾题 chips 出现', () => {
  render(<SettingsForm view={view} api={mkApi() as never} />)
  expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  expect(screen.queryByText(/推荐/)).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: /Java 后端/ })).toBeInTheDocument()   // 岗位 chip
  expect(screen.getByText(/点岗位 = 立刻勾上它的全部题目/)).toBeInTheDocument()
})

test('勾选任何块都不受岗位概念影响：列表全量、勾哪刷哪', async () => {
  const u = userEvent.setup()
  render(<SettingsForm view={view} api={mkApi() as never} />)
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))
  expect(screen.getByRole('checkbox', { name: /Redis/ })).toBeChecked()
  expect(screen.getByTestId('selected-count')).toHaveTextContent('已勾 2 个')
})

test('临时加密（§5.8）：填面试日期提交 → 调 postCram 并回显加密结果', async () => {
  const u = userEvent.setup()
  const api = mkCramApi()
  render(<SettingsForm view={view} api={api as never} />)
  await u.type(screen.getByLabelText(/^面试日期/), '2026-12-01')
  await u.click(screen.getByRole('button', { name: /开始冲刺/ }))
  expect(api.postCram).toHaveBeenCalledWith({ examDate: '2026-12-01', blockIds: ['b1'] })
  expect(await screen.findByText(/已重铺.*5/)).toBeInTheDocument()
})

// ---------- cram 与保存的顺序解耦（已保存块集语义） ----------

test('cram 只作用于已保存块集：勾选未保存时禁用并提示，恢复勾选后可用', async () => {
  const u = userEvent.setup()
  render(<SettingsForm view={view} api={mkCramApi() as never} />)
  await u.type(screen.getByLabelText(/^面试日期/), '2026-12-01')
  expect(screen.getByRole('button', { name: /开始冲刺/ })).toBeEnabled()
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))   // 有未保存变更
  expect(screen.getByRole('button', { name: /开始冲刺/ })).toBeDisabled()
  expect(screen.getByText(/先保存/)).toBeInTheDocument()
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))   // 回到已保存集
  expect(screen.getByRole('button', { name: /开始冲刺/ })).toBeEnabled()
})

test('加密卡片明示作用范围（已保存 N 块）与就绪日副作用', () => {
  render(<SettingsForm view={view} api={mkCramApi() as never} />)
  expect(screen.getByText(/已勾的 1 个块/)).toBeInTheDocument()
  expect(screen.getByText(/重铺到考前/)).toBeInTheDocument()
})

test('cram 成功后同步就绪日为返回值（防止后续保存写回旧值销毁加密）', async () => {
  const u = userEvent.setup()
  const api = {
    ...mkApi(),
    postCram: vi.fn(async () => ({ crammed: 5, excluded: 0, overloaded: false, readyByDate: '2026-10-31' })),
  }
  render(<SettingsForm view={view} api={api as never} />)
  await u.type(screen.getByLabelText(/^面试日期/), '2026-11-01')
  await u.click(screen.getByRole('button', { name: /开始冲刺/ }))
  expect(await screen.findByText(/已重铺.*5/)).toBeInTheDocument()
  expect(screen.getByLabelText(/目标日期/)).toHaveValue('2026-10-31')
})

test('cram 失败 → role=alert 显示服务端错误', async () => {
  const u = userEvent.setup()
  const api = {
    ...mkApi(),
    postCram: vi.fn(async () => { throw new Error('块未解锁：b2') }),
  }
  render(<SettingsForm view={view} api={api as never} />)
  await u.type(screen.getByLabelText(/^面试日期/), '2026-12-01')
  await u.click(screen.getByRole('button', { name: /开始冲刺/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/块未解锁/)
})

test('在加密区日期框按 Enter → 触发加密而非保存设置', async () => {
  const u = userEvent.setup()
  const api = mkCramApi()
  render(<SettingsForm view={view} api={api as never} />)
  await u.type(screen.getByLabelText(/^面试日期/), '2026-12-01{enter}')
  expect(api.postCram).toHaveBeenCalledWith(expect.objectContaining({ examDate: '2026-12-01' }))
  expect(api.postSettings).not.toHaveBeenCalled()
})

// ---------- 保存的 pending / 错误 / 三态反馈 ----------

test('保存 pending：请求期间按钮禁用显示保存中，完成后恢复', async () => {
  const u = userEvent.setup()
  let resolve!: (v: { replanned: number; changed: boolean }) => void
  const api = {
    postSettings: vi.fn(() => new Promise<{ replanned: number; changed: boolean }>(res => { resolve = res })),
    postBlocks: vi.fn(async () => ({ paused: 0, added: 0 })),
  }
  render(<SettingsForm view={view} api={api as never} />)
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(screen.getByRole('button', { name: /保存中/ })).toBeDisabled()
  resolve({ replanned: 0, changed: false })
  expect(await screen.findByText(/设置未变化/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^保存/ })).toBeEnabled()
})

test('保存第一步失败：role=alert 显示错误，块集请求不发出', async () => {
  const u = userEvent.setup()
  const api = {
    postSettings: vi.fn(async () => { throw new Error('容量须为 ≥1 的整数') }),
    postBlocks: vi.fn(async () => ({ paused: 0, added: 0 })),
  }
  render(<SettingsForm view={view} api={api as never} />)
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/容量/)
  expect(api.postBlocks).not.toHaveBeenCalled()
})

test('保存第二步失败：提示设置已保存但块集未更新', async () => {
  const u = userEvent.setup()
  const api = {
    postSettings: vi.fn(async () => ({ replanned: 3, changed: true })),
    postBlocks: vi.fn(async () => { throw new Error('块 id 不存在：ghost') }),
  }
  render(<SettingsForm view={view} api={api as never} />)
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))   // 有块集变更才会走第二步
  await u.click(screen.getByRole('button', { name: /保存/ }))
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(/设置已保存/)
  expect(alert).toHaveTextContent(/不存在/)
})

test('保存反馈三态：无变化 / 常备保持 / 已重排', async () => {
  const u = userEvent.setup()
  // 无变化
  const a = mkApi()
  a.postSettings.mockResolvedValueOnce({ replanned: 0, changed: false })
  const { unmount: m1 } = render(<SettingsForm view={view} api={a as never} />)
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(await screen.findByText(/设置未变化/)).toBeInTheDocument()
  m1()
  // 常备模式（changed 但重排 0）
  const b = mkApi()
  b.postSettings.mockResolvedValueOnce({ replanned: 0, changed: true })
  const { unmount: m2 } = render(<SettingsForm view={view} api={b as never} />)
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(await screen.findByText(/日常滚动保持不变/)).toBeInTheDocument()
  m2()
  // 有重排
  const c = mkApi()
  c.postSettings.mockResolvedValueOnce({ replanned: 7, changed: true })
  render(<SettingsForm view={view} api={c as never} />)
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(await screen.findByText(/重排.*7/)).toBeInTheDocument()
})

// ---------- 容量服务端预校验的客户端镜像 ----------

test('容量清空或为 0 → 保存禁用并提示 ≥1', async () => {
  const u = userEvent.setup()
  render(<SettingsForm view={view} api={mkApi() as never} />)
  const cap = screen.getByLabelText(/每天刷几题/)
  await u.clear(cap)
  expect(screen.getByRole('button', { name: /保存/ })).toBeDisabled()
  expect(screen.getByText(/须为 ≥1/)).toBeInTheDocument()
  await u.type(cap, '0')
  expect(screen.getByRole('button', { name: /保存/ })).toBeDisabled()
})

// ---------- 岗位与块列表联动 ----------

// ---------- 反馈语义重整（2026-09-30）：dirty 指示 / 保存反馈分流 / 块计数 / cram 副作用 ----------

test('只改块集保存 → 「已保存，排期未重排」而非说谎的「设置未变化」', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  api.postSettings.mockResolvedValueOnce({ replanned: 0, changed: false })   // 服务端：设置项没变
  render(<SettingsForm view={view} api={api as never} />)
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(await screen.findByText(/已保存：块集已更新，排期未重排/)).toBeInTheDocument()
})

test('未保存变更常驻提示：改动出现、保存成功后消失', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  render(<SettingsForm view={view} api={api as never} />)
  expect(screen.queryByTestId('dirty-hint')).not.toBeInTheDocument()
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))
  expect(screen.getByTestId('dirty-hint')).toHaveTextContent(/有未保存的变更/)
  api.postSettings.mockResolvedValueOnce({ replanned: 0, changed: false })
  await u.click(screen.getByRole('button', { name: /保存/ }))
  await screen.findByText(/排期未重排/)
  expect(screen.queryByTestId('dirty-hint')).not.toBeInTheDocument()
})

test('改容量触发未保存提示', async () => {
  const u = userEvent.setup()
  render(<SettingsForm view={view} api={mkApi() as never} />)
  await u.clear(screen.getByLabelText(/每天刷几题/))
  await u.type(screen.getByLabelText(/每天刷几题/), '30')
  expect(screen.getByTestId('dirty-hint')).toBeInTheDocument()
})

test('块区常驻「已勾 N 个」计数', () => {
  render(<SettingsForm view={view} api={mkApi() as never} />)
  expect(screen.getByTestId('selected-count')).toHaveTextContent('已勾 1 个')
})

test('cram 成功后基线同步：不误报未保存，结果明示就绪日副作用', async () => {
  const u = userEvent.setup()
  const api = {
    ...mkApi(),
    postCram: vi.fn(async () => ({ crammed: 5, excluded: 0, overloaded: false, readyByDate: '2026-10-31' })),
  }
  render(<SettingsForm view={view} api={api as never} />)
  await u.type(screen.getByLabelText(/^面试日期/), '2026-11-01')
  await u.click(screen.getByRole('button', { name: /开始冲刺/ }))
  const result = await screen.findByTestId('cram-result')
  expect(result).toHaveTextContent(/已重铺 5 张/)
  expect(result).toHaveTextContent(/目标日期 → 2026-10-31/)
  expect(screen.getByLabelText(/目标日期/)).toHaveValue('2026-10-31')
  expect(screen.queryByTestId('dirty-hint')).not.toBeInTheDocument()   // 基线已同步
})

test('cram 成功后清掉过期的保存反馈', async () => {
  const u = userEvent.setup()
  const api = mkCramApi()
  api.postSettings.mockResolvedValueOnce({ replanned: 9, changed: true })
  render(<SettingsForm view={view} api={api as never} />)
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(await screen.findByText(/重排.*9/)).toBeInTheDocument()
  await u.type(screen.getByLabelText(/^面试日期/), '2026-12-01')
  await u.click(screen.getByRole('button', { name: /开始冲刺/ }))
  await screen.findByTestId('cram-result')
  expect(screen.queryByText(/重排.*9/)).not.toBeInTheDocument()
})

test('就绪日 date input 的 min 不早于今天（挡住「填过去日期按常备」的困惑）', async () => {
  const u = userEvent.setup()
  render(<SettingsForm view={view} api={mkApi() as never} />)
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  await screen.findByLabelText(/目标日期/)   // 等 useEffect 填充
  expect(screen.getByLabelText(/目标日期/)).toHaveAttribute('min', `${d.getFullYear()}-${mm}-${dd}`)
})
