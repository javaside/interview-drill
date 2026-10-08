import { matchKnownDebt } from '../../../src/lib/content/audit.js'

const POOL = '块 java/generics 卡 01M3M39N0Z840CFBC8RWQ0R8FV（enumeration）的同块干扰项池不足：可用 7 条，下界 12'
const FP = 'min-block-pool|java/generics|01M3M39N0Z840CFBC8RWQ0R8FV'

test('登记命中 → known 降级；未登记同类 → 仍 open', () => {
  const r = matchKnownDebt([POOL], [FP])
  expect(r.known).toEqual([POOL])
  expect(r.open).toEqual([])
  const other = POOL.replace('java/generics', 'java/string')
  const r2 = matchKnownDebt([POOL, other], [FP])
  expect(r2.known).toEqual([POOL])
  expect(r2.open).toEqual([other])
})

test('登记了但 audit 已不报 → stale 提示可清理', () => {
  const r = matchKnownDebt([], [FP])
  expect(r.stale).toEqual([FP])
  expect(r.open).toEqual([])
})

test('无指纹模式的 issue 一律 open（不可登记，保守正确）', () => {
  const weird = '某种未来新增规则的问题：xxx'
  const r = matchKnownDebt([weird], [FP, 'some-fp'])
  expect(r.open).toEqual([weird])
  expect(r.stale).toEqual([FP, 'some-fp'])
})

test('池不足数字变化（补卡后可用条数变）不破坏指纹——指纹只认 块|卡', () => {
  const evolved = POOL.replace('可用 7 条', '可用 11 条')
  const r = matchKnownDebt([evolved], [FP])
  expect(r.known).toEqual([evolved])
})
