import { checkKeyPointText, checkBlockName, checkPlaceholders, checkSequenceKeyPointText, MAX_KP_HAN_CHARS } from '../../../src/lib/content/rules.js'

test('要点汉字数上界是 30', () => {
  expect(MAX_KP_HAN_CHARS).toBe(30)
})

test('超长要点被拒，并报出实际字数', () => {
  const long = '在' .repeat(31)
  const issues = checkKeyPointText(long)
  expect(issues).toHaveLength(1)
  expect(issues[0]).toContain('31')
})

test('长度只数汉字，不数英文和标点', () => {
  const s = 'state 是 volatile int，表示同步状态，独占锁下 0 表示空闲'
  expect(checkKeyPointText(s)).toEqual([])
})

test.each(['等', '多种', '一系列', '若干', '之类', '诸如', '各种'])(
  '承载词「%s」命中即失败', (word) => {
    const issues = checkKeyPointText(`AQS 支持独占和共享${word}模式`)
    expect(issues.some(i => i.includes(word))).toBe(true)
  },
)

test('正常要点无问题', () => {
  expect(checkKeyPointText('获取锁是对 state 做 CAS，成功即持有')).toEqual([])
})

test('脚手架占位符被识别', () => {
  expect(checkPlaceholders('待填写要点 1')).toHaveLength(1)
  expect(checkPlaceholders('https://example.org/REPLACE-ME')).toHaveLength(2)
  expect(checkPlaceholders('获取锁是对 state 做 CAS')).toEqual([])
})

test.each(['基础', '进阶', '高级', '其他', '常见问题', '高频'])(
  '块名黑名单「%s」命中即失败', (word) => {
    expect(checkBlockName(`MySQL ${word}`)).toHaveLength(1)
  },
)

test.each(['第 1 步 应用发起请求', '第 2 步：模型输出意图', '第 3 步 应用执行调用', '① 应用发起请求', '步骤4 提交'])(
  'sequence 要点自带顺序标号「%s」即失败——排序题答案不得写在题面上', (text) => {
    expect(checkSequenceKeyPointText(text)).toHaveLength(1)
  },
)

test('sequence 要点无顺序标号则通过（顺序只应蕴含在内容逻辑里）', () => {
  expect(checkSequenceKeyPointText('客户端发 SYN 进 SYN_SENT 状态')).toEqual([])
  expect(checkSequenceKeyPointText('模型只决策不执行，输出调用意图')).toEqual([])
})

test('合格的块名通过', () => {
  expect(checkBlockName('MVCC 与 Undo Log')).toEqual([])
})
