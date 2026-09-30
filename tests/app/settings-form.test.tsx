import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsForm } from '../../src/app/settings/SettingsForm.js'
import type { LocalDate } from '../../src/lib/scheduler/date.js'

const baseView = {
  readyByDate: '2026-11-01', dailyCapacity: 45, plan: 'free',
  trackId: 'java-backend',
  tracks: [{ id: 'java-backend', name: 'Java 后端', tagline: '服务端主力岗', blockIds: ['b1', 'b2', 'b3'] }],
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
  expect(screen.getByLabelText(/就绪日/)).toHaveValue('2026-11-01')
  expect(screen.getByLabelText(/每日容量|容量/)).toHaveValue(45)
  expect(screen.getByRole('checkbox', { name: /MySQL/ })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: /Redis/ })).not.toBeChecked()
})

test('块列表按大类分组展示（组标题 + 各组内块）', () => {
  render(<SettingsForm view={view} api={mkApi() as never} />)
  const mysql = screen.getByRole('heading', { name: /mysql/i })
  const jvm = screen.getByRole('heading', { name: /jvm/i })
  expect(mysql).toBeInTheDocument()
  expect(jvm).toBeInTheDocument()
  // mysql 组内两块、jvm 组内一块：checkbox 只在各自 section 下出现一次
  expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  expect(mysql.nextElementSibling?.querySelectorAll('input[type=checkbox]')).toHaveLength(2)
  expect(jvm.nextElementSibling?.querySelectorAll('input[type=checkbox]')).toHaveLength(1)
})

test('免费墙即时防呆：勾满 2 块当场双提示（行间跟随 + sticky 顶部）并锁住其余块', async () => {
  const u = userEvent.setup()
  render(<SettingsForm view={view} api={mkApi() as never} />)
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))   // 2/2 满
  // 行间跟随提示：插在刚勾的那行后面（视线焦点处）；sticky 顶部提示同现
  expect(screen.getByTestId('inline-cap-status')).toHaveTextContent(/已选满，取消一个可更换/)
  expect(screen.getByTestId('free-cap-status')).toHaveTextContent(/已选满，取消一个可更换/)
  for (const link of screen.getAllByRole('link', { name: /升级/ })) {
    expect(link).toHaveAttribute('href', '/upgrade')
  }
  // 未勾选的块被禁用：点不动，不会偷偷超限，拉到保存键才挨骂
  const jvm = screen.getByRole('checkbox', { name: /JVM/ })
  expect(jvm).toBeDisabled()
  await u.click(jvm)
  expect(jvm).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: /MySQL/ })).toBeEnabled()   // 已勾选的仍可取消更换
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))          // 取消一块
  expect(screen.getByRole('checkbox', { name: /JVM/ })).toBeEnabled()
  expect(screen.queryByTestId('inline-cap-status')).not.toBeInTheDocument()
  expect(screen.queryByTestId('free-cap-status')).not.toBeInTheDocument()
})

test('保存：调 postSettings + postBlocks，显示重排条数', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  render(<SettingsForm view={view} api={api as never} />)
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))   // 有块集变更才发 postBlocks
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(api.postSettings).toHaveBeenCalledWith({ readyByDate: '2026-11-01', dailyCapacity: 45, trackId: 'java-backend' })
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

test('岗位单选：预选当前岗位，切到「全部」后保存带 trackId null', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  render(<SettingsForm view={view} api={api as never} />)
  expect(screen.getByRole('radio', { name: /Java 后端/ })).toBeChecked()
  expect(screen.getByRole('radio', { name: /^全部$/ })).not.toBeChecked()
  await u.click(screen.getByRole('radio', { name: /^全部$/ }))
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(api.postSettings).toHaveBeenCalledWith(expect.objectContaining({ trackId: null }))
})

test('临时加密（§5.8）：填面试日期提交 → 调 postCram 并回显加密结果', async () => {
  const u = userEvent.setup()
  const api = mkCramApi()
  render(<SettingsForm view={view} api={api as never} />)
  await u.type(screen.getByLabelText(/^面试日期/), '2026-12-01')
  await u.click(screen.getByRole('button', { name: /临时加密|加密/ }))
  expect(api.postCram).toHaveBeenCalledWith({ examDate: '2026-12-01', blockIds: ['b1'] })
  expect(await screen.findByText(/已加密.*5/)).toBeInTheDocument()
})

// ---------- cram 与保存的顺序解耦（已保存块集语义） ----------

test('cram 只作用于已保存块集：勾选未保存时禁用并提示，恢复勾选后可用', async () => {
  const u = userEvent.setup()
  render(<SettingsForm view={view} api={mkCramApi() as never} />)
  await u.type(screen.getByLabelText(/^面试日期/), '2026-12-01')
  expect(screen.getByRole('button', { name: /临时加密|加密/ })).toBeEnabled()
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))   // 有未保存变更
  expect(screen.getByRole('button', { name: /临时加密|加密/ })).toBeDisabled()
  expect(screen.getByText(/先保存/)).toBeInTheDocument()
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))   // 回到已保存集
  expect(screen.getByRole('button', { name: /临时加密|加密/ })).toBeEnabled()
})

test('加密卡片明示作用范围（已保存 N 块）与就绪日副作用', () => {
  render(<SettingsForm view={view} api={mkCramApi() as never} />)
  expect(screen.getByText(/已保存的 1 个块/)).toBeInTheDocument()
  expect(screen.getByText(/面试前一天/)).toBeInTheDocument()
})

test('cram 成功后同步就绪日为返回值（防止后续保存写回旧值销毁加密）', async () => {
  const u = userEvent.setup()
  const api = {
    ...mkApi(),
    postCram: vi.fn(async () => ({ crammed: 5, excluded: 0, overloaded: false, readyByDate: '2026-10-31' })),
  }
  render(<SettingsForm view={view} api={api as never} />)
  await u.type(screen.getByLabelText(/^面试日期/), '2026-11-01')
  await u.click(screen.getByRole('button', { name: /临时加密|加密/ }))
  expect(await screen.findByText(/已加密.*5/)).toBeInTheDocument()
  expect(screen.getByLabelText(/就绪日/)).toHaveValue('2026-10-31')
})

test('cram 失败 → role=alert 显示服务端错误', async () => {
  const u = userEvent.setup()
  const api = {
    ...mkApi(),
    postCram: vi.fn(async () => { throw new Error('块未解锁：b2') }),
  }
  render(<SettingsForm view={view} api={api as never} />)
  await u.type(screen.getByLabelText(/^面试日期/), '2026-12-01')
  await u.click(screen.getByRole('button', { name: /临时加密|加密/ }))
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
  expect(await screen.findByText(/滚动计划保持不变/)).toBeInTheDocument()
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
  const cap = screen.getByLabelText(/每日容量|容量/)
  await u.clear(cap)
  expect(screen.getByRole('button', { name: /保存/ })).toBeDisabled()
  expect(screen.getByText(/容量须为 ≥1/)).toBeInTheDocument()
  await u.type(cap, '0')
  expect(screen.getByRole('button', { name: /保存/ })).toBeDisabled()
})

// ---------- 岗位与块列表联动 ----------

test('岗位联动（无过滤）：列表永远全量展示，岗位块常挂「推荐」徽标', async () => {
  const u = userEvent.setup()
  const v = {
    ...baseView,
    tracks: [{ id: 'java-backend', name: 'Java 后端', tagline: 'x', blockIds: ['b1', 'b3'] }],
  } as never
  render(<SettingsForm view={v} api={mkApi() as never} />)
  // 全量展示：三个块都在，没有任何视野切换控件
  expect(screen.getByRole('checkbox', { name: /MySQL/ })).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: /Redis/ })).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: /JVM/ })).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: '块列表视野' })).not.toBeInTheDocument()
  // 岗位包含的块带「推荐」徽标，岗位外没有；一行小字说明两种标记的语义
  expect(screen.getByRole('checkbox', { name: /MySQL/ }).closest('label')).toHaveTextContent(/推荐/)
  expect(screen.getByRole('checkbox', { name: /Redis/ }).closest('label')).not.toHaveTextContent(/推荐/)
  expect(screen.getByText(/标「推荐」的是 Java 后端 岗位包含的块；勾选 = 要刷的块/)).toBeInTheDocument()
})

test('切到「全部」岗位：推荐徽标与说明消失（无岗位即无推荐概念）', async () => {
  const u = userEvent.setup()
  const v = {
    ...baseView,
    tracks: [{ id: 'java-backend', name: 'Java 后端', tagline: 'x', blockIds: ['b1', 'b3'] }],
  } as never
  render(<SettingsForm view={v} api={mkApi() as never} />)
  await u.click(screen.getByRole('radio', { name: /^全部$/ }))
  expect(screen.getByRole('checkbox', { name: /MySQL/ }).closest('label')).not.toHaveTextContent(/推荐/)
  expect(screen.queryByText(/标「推荐」的是/)).not.toBeInTheDocument()
})

// ---------- 反馈语义重整（2026-09-30）：dirty 指示 / 保存反馈分流 / 块计数 / cram 副作用 ----------

test('只改块集保存 → 「已保存，排期未重排」而非说谎的「设置未变化」', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  api.postSettings.mockResolvedValueOnce({ replanned: 0, changed: false })   // 服务端：设置项没变
  render(<SettingsForm view={view} api={api as never} />)
  await u.click(screen.getByRole('checkbox', { name: /Redis/ }))
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(await screen.findByText(/已保存：块集\/岗位已更新，排期未重排/)).toBeInTheDocument()
})

test('只改岗位保存 → 同样得到「已保存，排期未重排」', async () => {
  const u = userEvent.setup()
  const api = mkApi()
  api.postSettings.mockResolvedValueOnce({ replanned: 0, changed: false })
  render(<SettingsForm view={view} api={api as never} />)
  await u.click(screen.getByRole('radio', { name: /^全部$/ }))
  await u.click(screen.getByRole('button', { name: /保存/ }))
  expect(await screen.findByText(/已保存：块集\/岗位已更新，排期未重排/)).toBeInTheDocument()
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

test('改容量/岗位同样触发未保存提示', async () => {
  const u = userEvent.setup()
  render(<SettingsForm view={view} api={mkApi() as never} />)
  await u.clear(screen.getByLabelText(/每日容量|容量/))
  await u.type(screen.getByLabelText(/每日容量|容量/), '30')
  expect(screen.getByTestId('dirty-hint')).toBeInTheDocument()
  await u.click(screen.getByRole('radio', { name: /^全部$/ }))
  expect(screen.getByTestId('dirty-hint')).toBeInTheDocument()
})

test('块区常驻「已勾 N 个」计数——措辞与岗位「推荐」严格分离', () => {
  const v = {
    ...baseView,
    tracks: [{ id: 'java-backend', name: 'Java 后端', tagline: 'x', blockIds: ['b2', 'b3'] }],
  } as never   // 已勾 b1(MySQL) 不在岗位内 → 有推荐概念但徽标不落在它身上
  render(<SettingsForm view={v} api={mkApi() as never} />)
  expect(screen.getByTestId('selected-count')).toHaveTextContent('已勾 1 个')
  // 无任何视野过滤控件与「视野外」提示——列表全量、勾哪刷哪
  expect(screen.getByRole('checkbox', { name: /MySQL/ })).toBeInTheDocument()
  expect(screen.queryByTestId('hidden-selected')).not.toBeInTheDocument()
})

test('cram 成功后基线同步：不误报未保存，结果明示就绪日副作用', async () => {
  const u = userEvent.setup()
  const api = {
    ...mkApi(),
    postCram: vi.fn(async () => ({ crammed: 5, excluded: 0, overloaded: false, readyByDate: '2026-10-31' })),
  }
  render(<SettingsForm view={view} api={api as never} />)
  await u.type(screen.getByLabelText(/^面试日期/), '2026-11-01')
  await u.click(screen.getByRole('button', { name: /临时加密|加密/ }))
  const result = await screen.findByTestId('cram-result')
  expect(result).toHaveTextContent(/已加密 5 张/)
  expect(result).toHaveTextContent(/就绪日 → 2026-10-31/)
  expect(screen.getByLabelText(/就绪日/)).toHaveValue('2026-10-31')
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
  await u.click(screen.getByRole('button', { name: /临时加密|加密/ }))
  await screen.findByTestId('cram-result')
  expect(screen.queryByText(/重排.*9/)).not.toBeInTheDocument()
})

test('就绪日 date input 的 min 不早于今天（挡住「填过去日期按常备」的困惑）', async () => {
  const u = userEvent.setup()
  render(<SettingsForm view={view} api={mkApi() as never} />)
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  await screen.findByLabelText(/就绪日/)   // 等 useEffect 填充
  expect(screen.getByLabelText(/就绪日/)).toHaveAttribute('min', `${d.getFullYear()}-${mm}-${dd}`)
})
