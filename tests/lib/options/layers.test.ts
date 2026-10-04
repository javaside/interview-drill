import {
  categorySequenceOf, layerOf, neighborCategoryOf,
} from '../../../src/lib/options/layers.js'

/** 同一组「块 → 大类」的两种行序：runtime 走 DB（无 ORDER BY）、工具走文件系统（无序） */
const FILE_ORDER = new Map([['b1', 'java'], ['b2', 'mysql'], ['b3', 'agent'], ['b4', 'jvm']])
const DB_ORDER = new Map([['b3', 'agent'], ['b4', 'jvm'], ['b1', 'java'], ['b2', 'mysql']])

test('大类序列与输入行序无关（按名称升序）—— 两侧各按自己的行序就会各查一半', () => {
  expect(categorySequenceOf(FILE_ORDER)).toEqual(['agent', 'java', 'jvm', 'mysql'])
  expect(categorySequenceOf(DB_ORDER)).toEqual(['agent', 'java', 'jvm', 'mysql'])
})

test('相邻大类逐块一致：文件序与 DB 序给出同一个邻居', () => {
  for (const cat of ['agent', 'java', 'jvm', 'mysql']) {
    expect(neighborCategoryOf(FILE_ORDER, cat)).toBe(neighborCategoryOf(DB_ORDER, cat))
  }
  // 升序序列下的循环：agent → java → jvm → mysql → agent
  expect(neighborCategoryOf(FILE_ORDER, 'agent')).toBe('java')
  expect(neighborCategoryOf(FILE_ORDER, 'mysql')).toBe('agent')
})

test('少于两个大类 / current 不在序列中 → 无邻居', () => {
  const one = new Map([['b1', 'java'], ['b2', 'java']])
  expect(neighborCategoryOf(one, 'java')).toBeUndefined()
  expect(neighborCategoryOf(FILE_ORDER, 'nosuch')).toBeUndefined()
})

test('三层判定：同块 / 同大类跨块 / 相邻大类 / 都不是', () => {
  const m = new Map([...FILE_ORDER, ['b9', 'java'], ['b7', 'agent'], ['b8', 'rpc']])
  expect(layerOf('b1', 'b1', m)).toBe('sameBlock')     // 目标卡自己的块
  expect(layerOf('b1', 'b9', m)).toBe('crossBlock')    // 同 java
  expect(layerOf('b1', 'b4', m)).toBe('neighbor')      // java 的下一项 = jvm
  expect(layerOf('b1', 'b7', m)).toBeNull()            // agent 是 java 的上一个方向，不进相邻层
  expect(layerOf('b1', 'b8', m)).toBeNull()            // rpc 既不同类也不是 java 的邻居
  expect(layerOf('b1', 'b8', FILE_ORDER)).toBeNull()   // 块不在 map 里
})

test('相邻层随大类名升序的循环走 —— 不是插入序里的下一个', () => {
  // 插入序是 java → mysql → agent → jvm，插入序下 java 的邻居会是 mysql。
  // 升序后 java 的邻居是 jvm：这就是实测「方向写反换掉整个相邻层」的那个差异。
  expect(neighborCategoryOf(FILE_ORDER, 'java')).toBe('jvm')
  expect(layerOf('b1', 'b2', FILE_ORDER)).toBeNull()   // mysql 不在 java 的相邻层
})
