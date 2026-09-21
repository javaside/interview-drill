import { fnv1a, seedRng, hashSeed, shuffle } from '../../../src/lib/options/rng.js'

test('fnv1a：空串是 FNV 偏移基数，非空串确定且可区分', () => {
  expect(fnv1a('')).toBe(0x811c9dc5)
  expect(fnv1a('a')).toBe(fnv1a('a'))
  expect(fnv1a('a')).not.toBe(fnv1a('b'))
})

test('seedRng：同种子同序列，异种子异序列', () => {
  const a1 = seedRng(42), a2 = seedRng(42), b = seedRng(43)
  const s1 = [a1(), a1(), a1(), a1(), a1()]
  const s2 = [a2(), a2(), a2(), a2(), a2()]
  expect(s1).toEqual(s2)
  expect([b(), b(), b(), b(), b()]).not.toEqual(s1)
})

test('seedRng：值域 [0,1)', () => {
  const r = seedRng(7)
  for (let i = 0; i < 1000; i++) {
    const v = r()
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(1)
  }
})

test('hashSeed：三元组稳定，各分量与分隔符都参与区分', () => {
  expect(hashSeed('u', 'c', 0)).toBe(hashSeed('u', 'c', 0))
  expect(hashSeed('u', 'c', 0)).not.toBe(hashSeed('u', 'c', 1))
  expect(hashSeed('u', 'c', 0)).not.toBe(hashSeed('u2', 'c', 0))
  // NUL 分隔符防拼接歧义：('u:2','c') 与 ('u','2:c') 不是同一个输入
  expect(hashSeed('u:2', 'c', 0)).not.toBe(hashSeed('u', '2:c', 0))
})

test('shuffle：结果是原元素的一个排列，且不改输入', () => {
  const rng = seedRng(1234)
  const src = [1, 2, 3, 4, 5, 6, 7, 8]
  const out = shuffle(src, rng)
  expect([...out].sort((x, y) => x - y)).toEqual(src)
  expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
})

test('shuffle：同种子逐字节复现', () => {
  const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], seedRng(9))
  const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], seedRng(9))
  expect(a).toEqual(b)
})

test('shuffle：空数组与单元素不炸', () => {
  expect(shuffle([], seedRng(1))).toEqual([])
  expect(shuffle(['x'], seedRng(1))).toEqual(['x'])
})
