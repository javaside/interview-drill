import {
  scoreSelection, scoreSequence, scoreJudgment, scoreAtomic,
} from '../../../src/lib/mastery/score.js'

test('scoreSelection：max(0, (对−错)/总数)——减勾错数堵乱勾全选，下限 0', () => {
  expect(scoreSelection(2, 0, 3)).toEqual({ num: 2, den: 3 })
  expect(scoreSelection(3, 1, 3)).toEqual({ num: 2, den: 3 })
  expect(scoreSelection(1, 1, 3)).toEqual({ num: 0, den: 1 })   // 对错相抵
  expect(scoreSelection(0, 5, 3)).toEqual({ num: 0, den: 1 })   // 下限 0（§4.4）
  expect(scoreSelection(3, 0, 3)).toEqual({ num: 1, den: 1 })
})

test('scoreSelection：正确总数 < 1 或勾对数超总数是调用方 bug，抛错', () => {
  expect(() => scoreSelection(1, 0, 0)).toThrow()
  expect(() => scoreSelection(4, 0, 3)).toThrow()   // 勾对数 > 正确总数 → 会破坏 [0,1]
  expect(() => scoreSelection(-1, 0, 3)).toThrow()
})

test('scoreSelection：勾错数为负是调用方 bug，抛错', () => {
  expect(() => scoreSelection(1, -1, 3)).toThrow()
})

test('scoreSequence：全序满分、全反 0 分、部分分按逆序对（§4.4）', () => {
  const canon = ['a', 'b', 'c', 'd']
  expect(scoreSequence(canon, canon)).toEqual({ num: 1, den: 1 })
  expect(scoreSequence(['d', 'c', 'b', 'a'], canon)).toEqual({ num: 0, den: 1 })
  // [b,a,c,d] 恰 1 个逆序对，最大 6 → 5/6
  expect(scoreSequence(['b', 'a', 'c', 'd'], canon)).toEqual({ num: 5, den: 6 })
  // [c,d,a,b] 逆序对 (c,a)(c,b)(d,a)(d,b) = 4 → 2/6 = 1/3
  expect(scoreSequence(['c', 'd', 'a', 'b'], canon)).toEqual({ num: 1, den: 3 })
  // 单元素：无逆序可言，满分（防御路径，schema 要求 sequence ≥ 4 要点）
  expect(scoreSequence(['a'], ['a'])).toEqual({ num: 1, den: 1 })
})

test('scoreSequence：不是排列直接抛错（调用方 bug）', () => {
  expect(() => scoreSequence(['a', 'b', 'c'], ['a', 'b', 'c', 'd'])).toThrow()
  expect(() => scoreSequence(['a', 'b', 'e', 'd'], ['a', 'b', 'c', 'd'])).toThrow()
})

test('scoreJudgment：结论错 0 分；结论对 = 1/2 + 要点分/2（§4.4）', () => {
  expect(scoreJudgment(false, { num: 1, den: 1 })).toEqual({ num: 0, den: 1 })
  expect(scoreJudgment(true, { num: 0, den: 1 })).toEqual({ num: 1, den: 2 })
  expect(scoreJudgment(true, { num: 1, den: 2 })).toEqual({ num: 3, den: 4 })
  expect(scoreJudgment(true, { num: 2, den: 3 })).toEqual({ num: 5, den: 6 })
  expect(scoreJudgment(true, { num: 1, den: 1 })).toEqual({ num: 1, den: 1 })
})

test('scoreJudgment：非法 pointsScore 抛错，错误消息带实际值（终审）', () => {
  expect(() => scoreJudgment(true, { num: 2, den: 1 })).toThrow(/num:2, den:1/)   // num > den
  expect(() => scoreJudgment(true, { num: -1, den: 3 })).toThrow(/num:-1/)       // num < 0
  expect(() => scoreJudgment(true, { num: 1, den: 0 })).toThrow(/den:0/)         // den ≤ 0
  expect(() => scoreJudgment(true, { num: -2, den: -3 })).toThrow(/den:-3/)
  expect(() => scoreJudgment(true, { num: 0.5, den: 2 })).toThrow(/num:0\.5/)    // 非整数
  expect(() => scoreJudgment(true, { num: 1, den: 1.5 })).toThrow(/den:1\.5/)
  // 结论错也先过校验——非法输入是调用方 bug，不被 0 分路径掩盖
  expect(() => scoreJudgment(false, { num: 2, den: 1 })).toThrow()
  // 合法输入不回归
  expect(scoreJudgment(true, { num: 1, den: 2 })).toEqual({ num: 3, den: 4 })
})

test('scoreAtomic 与归一化：四型结果全部落在 [0,1] 且为精确分数（§11）', () => {
  expect(scoreAtomic(true)).toEqual({ num: 1, den: 1 })
  expect(scoreAtomic(false)).toEqual({ num: 0, den: 1 })
  const all = [
    scoreSelection(0, 0, 5), scoreSelection(5, 0, 5), scoreSelection(2, 3, 5),
    scoreSequence(['a'], ['a']),
    scoreSequence(['b', 'a', 'd', 'c'], ['a', 'b', 'c', 'd']),
    scoreJudgment(true, { num: 1, den: 3 }),
    scoreJudgment(false, { num: 1, den: 3 }),
    scoreAtomic(false), scoreAtomic(true),
  ]
  for (const r of all) {
    expect(r.den).toBeGreaterThan(0)
    expect(r.num).toBeGreaterThanOrEqual(0)
    expect(r.num).toBeLessThanOrEqual(r.den)   // 整数比较，不用浮点
  }
})
