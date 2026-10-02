import { accessStateOf, expiryAction } from '../../../src/lib/entitlement/expiry.js'
import type { LocalDate } from '../../../src/lib/scheduler/date.js'

const D = (s: string) => s as LocalDate
/** 2026-10-02T04:00Z = Asia/Shanghai 的 2026-10-02 12:00，today 与 nowMs 同一天 */
const NOW = Date.parse('2026-10-02T04:00:00Z')
const base = { nowMs: NOW, today: D('2026-10-02') }

test('accessStateOf：有效期内 paid，宽限期内 grace，否则 free', () => {
  expect(accessStateOf({ ...base, paidUntilMs: NOW + 86400_000, graceUntil: null })).toBe('paid')
  expect(accessStateOf({ ...base, paidUntilMs: NOW - 86400_000, graceUntil: D('2026-10-10') })).toBe('grace')
  expect(accessStateOf({ ...base, paidUntilMs: NOW - 86400_000, graceUntil: D('2026-10-01') })).toBe('free')
  expect(accessStateOf({ ...base, paidUntilMs: null, graceUntil: null })).toBe('free')
})

test('宽限末日当天仍算 grace（含当日边界）', () => {
  expect(accessStateOf({ ...base, paidUntilMs: NOW - 86400_000, graceUntil: D('2026-10-02') })).toBe('grace')
})

test('从未付费：expiryAction 不动任何东西', () => {
  expect(expiryAction({
    ...base, paidUntilMs: null, graceUntil: null, readyByDate: null, selection: [], scheduled: [],
  })).toEqual({ kind: 'none' })
})

test('通行证未到期：不结算', () => {
  expect(expiryAction({
    ...base, paidUntilMs: NOW + 86400_000, graceUntil: null, readyByDate: null,
    selection: ['b1'], scheduled: [],
  })).toEqual({ kind: 'none' })
})

test('维持模式到期：宽限 = 到期后 14 天，宽限块 = 有排期的块', () => {
  const a = expiryAction({
    ...base, paidUntilMs: NOW - 86400_000, graceUntil: null, readyByDate: null,
    selection: ['b1', 'b2', 'b3', 'b4'],
    scheduled: [
      { blockId: 'b1', lastPlannedDate: D('2026-10-05') },
      { blockId: 'b3', lastPlannedDate: D('2026-10-03') },
    ],
  })
  expect(a).toEqual({
    kind: 'settle', graceUntil: D('2026-10-16'),
    graceBlockIds: ['b1', 'b3'], freeBlockIds: ['b1', 'b3'],
  })
})

test('冲刺模式到期：宽限到在期排期的最后一天（至少到就绪日）', () => {
  const a = expiryAction({
    ...base, paidUntilMs: NOW - 86400_000, graceUntil: null, readyByDate: D('2026-10-20'),
    selection: [], scheduled: [{ blockId: 'b1', lastPlannedDate: D('2026-10-18') }],
  })
  expect(a).toEqual({
    kind: 'settle', graceUntil: D('2026-10-20'),
    graceBlockIds: ['b1'], freeBlockIds: ['b1'],
  })
})

test('冲刺模式：排期比就绪日更晚时取排期末日（更宽的那一个）', () => {
  const a = expiryAction({
    ...base, paidUntilMs: NOW - 86400_000, graceUntil: null, readyByDate: D('2026-10-20'),
    selection: [], scheduled: [{ blockId: 'b1', lastPlannedDate: D('2026-10-25') }],
  })
  expect(a).toMatchObject({ kind: 'settle', graceUntil: D('2026-10-25') })
})

test('就绪日已过（R<0）：算维持模式，用 14 天封顶', () => {
  const a = expiryAction({
    ...base, paidUntilMs: NOW - 86400_000, graceUntil: null, readyByDate: D('2026-09-01'),
    selection: [], scheduled: [{ blockId: 'b1', lastPlannedDate: D('2026-10-25') }],
  })
  expect(a).toEqual({
    kind: 'settle', graceUntil: D('2026-10-16'),
    graceBlockIds: ['b1'], freeBlockIds: ['b1'],
  })
})

test('勾选收敛：宽限块优先，用原勾选补齐到 2 个（新买即到期的用户不至 0 块）', () => {
  const a = expiryAction({
    ...base, paidUntilMs: NOW - 86400_000, graceUntil: null, readyByDate: null,
    selection: ['b9', 'b8', 'b7'],
    scheduled: [{ blockId: 'b1', lastPlannedDate: D('2026-10-03') }],
  })
  expect(a).toEqual({
    kind: 'settle', graceUntil: D('2026-10-16'),
    graceBlockIds: ['b1'], freeBlockIds: ['b1', 'b9'],
  })
})

test('宽限块 + 兜底勾选重复时去重（不足 2 个就不硬凑）', () => {
  const a = expiryAction({
    ...base, paidUntilMs: NOW - 86400_000, graceUntil: null, readyByDate: null,
    selection: ['b1'],
    scheduled: [{ blockId: 'b1', lastPlannedDate: D('2026-10-03') }],
  })
  expect(a).toMatchObject({ kind: 'settle', graceBlockIds: ['b1'], freeBlockIds: ['b1'] })
})

test('已结算且宽限未过：不动（幂等）', () => {
  expect(expiryAction({
    ...base, paidUntilMs: NOW - 86400_000, graceUntil: D('2026-10-16'), readyByDate: null,
    selection: ['b1'], scheduled: [],
  })).toEqual({ kind: 'none' })
})

test('宽限已结束且勾选超 2：收敛回 2 个（宽限期内可任意多选）', () => {
  expect(expiryAction({
    ...base, paidUntilMs: NOW - 86400_000, graceUntil: D('2026-10-01'), readyByDate: null,
    selection: ['b1', 'b2', 'b3'], scheduled: [],
  })).toEqual({ kind: 'clamp', freeBlockIds: ['b1', 'b2'] })
})

test('宽限已结束且勾选 ≤2：不动', () => {
  expect(expiryAction({
    ...base, paidUntilMs: NOW - 86400_000, graceUntil: D('2026-10-01'), readyByDate: null,
    selection: ['b1'], scheduled: [],
  })).toEqual({ kind: 'none' })
})

test('宽限已结束、勾选去重后 ≤2：不动（重复项不算超选）', () => {
  expect(expiryAction({
    ...base, paidUntilMs: NOW - 86400_000, graceUntil: D('2026-10-01'), readyByDate: null,
    selection: ['b1', 'b1'], scheduled: [],
  })).toEqual({ kind: 'none' })
})
