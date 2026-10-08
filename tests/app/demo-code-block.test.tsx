import { render, screen } from '@testing-library/react'
import { DemoCodeBlock } from '../../src/app/DemoCodeBlock.js'

const CODE = 'public class D {\n    public static void main(String[] args) { }\n}\n'

test('折叠展示：summary 固定文案，代码进 pre（jsdom 中 details 内容仍在 DOM）', () => {
  const { container } = render(<DemoCodeBlock code={CODE} />)
  expect(screen.getByText('可运行示例（Java）')).toBeInTheDocument()
  const pre = container.querySelector('pre')
  expect(pre).not.toBeNull()
  expect(pre!.textContent).toContain('public static void main')
})

test('高亮：关键字上 span.keyword 色（tokenize java）', () => {
  const { container } = render(<DemoCodeBlock code={CODE} />)
  const kw = container.querySelector('pre span.text-accent')
  expect(kw?.textContent).toContain('public')
})
