import { render } from '@testing-library/react'
import { RichText } from '../../src/app/RichText.js'

/**
 * React key 警告回归（独立文件是刻意的）：React 对同一警告按渲染栈去重，
 * 每个模块实例只会刷一次——放在共用文件里，警告会被前面的用例先吃掉，
 * 测试就永远绿。vitest 按文件隔离模块，这里必须是本文件的第一处渲染。
 */
test('Inline 的列表 Fragment 都带 key：渲染不产生 key 警告', () => {
  const calls: string[] = []
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    calls.push(args.map(a => String(a)).join(' '))
  })
  render(<RichText text={'混合 **粗体** 与 *斜体* 与 `代码`\n\n- 项一 **加粗**\n- 项二'} />)
  spy.mockRestore()

  const keyWarnings = calls.filter(m => m.includes('unique "key"'))
  expect(keyWarnings).toEqual([])
})
