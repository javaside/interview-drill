import { render, screen } from '@testing-library/react'
import { RichText } from '../../src/app/RichText.js'

test('回归：**粗体** 仍是 strong', () => {
  render(<RichText text="草稿本就是 **undo log**，很关键" />)
  const strong = screen.getByText('undo log')
  expect(strong.tagName).toBe('STRONG')
})

test('行内代码 `x` 渲染为 code 元素，裸反引号不再出现在页面上', () => {
  render(<RichText text="对 `state` 做 CAS" />)
  expect(screen.getByText('state').tagName).toBe('CODE')
  expect(screen.queryByText(/`/)).toBeNull()
})

test('无序列表渲染为 ul/li（裸「- 」不再出现）', () => {
  render(<RichText text={'两者都去首尾空白：\n- **trim()**：只认 ASCII\n- **strip()**：按 Unicode'} />)
  expect(screen.getByRole('list')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByText(/只认 ASCII/).closest('li')).not.toBeNull()
})

test('有序列表渲染为 ol/li', () => {
  render(<RichText text={'步骤：\n1. 先建连\n2. 再发请求'} />)
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByText('先建连').closest('ol')).not.toBeNull()
})

test('代码块渲染为 pre/code，内部 ** 与 - 原样保留（不做行内解析）', () => {
  render(<RichText text={'用法：\n```sql\nBEGIN;\nUPDATE t SET x=1;\n```\n完事。'} />)
  const pre = screen.getByText((_, el) => el?.tagName === 'PRE')
  expect(pre).toBeInTheDocument()
  expect(pre.textContent).toContain('UPDATE t SET x=1;')
  expect(screen.queryByText(/完事。.*UPDATE/s)).toBeNull()   // 代码块与段落分离
})

test('混合内容：段落/列表/代码块各自成块且顺序保持', () => {
  const { container } = render(
    <RichText text={'说明：\n\n- 要点一\n\n```java\nint x = 1;\n```\n\n收尾。'} />,
  )
  const tags = Array.from(container.children).map(el => el.tagName.toLowerCase())
  expect(tags).toEqual(['p', 'ul', 'pre', 'p'])
})

test('表格渲染为 table/th/td，单元格内粗体仍解析（截图缺陷回归）', () => {
  render(<RichText text={'| | ReAct | 先谋后动 |\n|---|---|---|\n| 节奏 | 每步观察 | **完整计划** |'} />)
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getAllByRole('columnheader')).toHaveLength(3)
  expect(screen.getAllByRole('cell')).toHaveLength(3)
  const bold = screen.getByText('完整计划')
  expect(bold.tagName).toBe('STRONG')
})

test('引用块渲染为 blockquote，标题渲染为 heading 元素', () => {
  const { container } = render(<RichText text={'> 一句引用\n\n## 小节\n正文'} />)
  expect(container.querySelector('blockquote')).not.toBeNull()
  expect(container.querySelector('h3')).not.toBeNull()
  expect(screen.getByText('正文').closest('p')).not.toBeNull()
})
