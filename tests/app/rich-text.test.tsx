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
  // 代码块现在带容器（语言标签 + 圆角卡片），故第三块是 div，pre 在其内部
  const tags = Array.from(container.children).map(el => el.tagName.toLowerCase())
  expect(tags).toEqual(['p', 'ul', 'div', 'p'])
  expect(container.querySelectorAll('pre')).toHaveLength(1)
  expect(container.querySelector('pre')?.textContent).toContain('int x = 1;')
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

test('斜体 *x* 渲染为 em，裸星号不再出现；粗体内乘号不受影响', () => {
  render(<RichText text={'目标：*In Search of an Understandable Consensus Algorithm*（2013）'} />)
  const em = screen.getByText(/In Search of an Understandable Consensus Algorithm/)
  expect(em.tagName).toBe('EM')
})

test('粗体段内的数学乘号单星不产生 em（回归：hashCode 公式）', () => {
  render(<RichText text={'公式：**h = 0; 对每个字符 c：h = 31*h + c**——即迭代乘 31'} />)
  expect(screen.getByText(/31\*h \+ c/).tagName).toBe('STRONG')
  expect(document.querySelectorAll('em')).toHaveLength(0)
})

test('代码块按语法着色：关键字荧光黄、注释蓝灰斜体、字面量降透明', () => {
  const { container } = render(
    <RichText text={'```java\npublic int x = 42; // 说明\n```'} />,
  )
  const marker = (sel: string): string[] =>
    Array.from(container.querySelectorAll(sel)).map(el => el.textContent ?? '')

  expect(marker('span.text-accent')).toEqual(['public', 'int'])
  expect(marker('span.text-accent\\/70')).toEqual(['42'])
  expect(marker('span.italic')).toEqual(['// 说明'])
  // 正文仍是完整代码（着色不丢字符）
  expect(container.querySelector('pre')?.textContent).toBe('public int x = 42; // 说明')
})

test('代码块显示语言标签；语言名认不出时不显示标签也不上色', () => {
  const { container, unmount } = render(<RichText text={'```sql\nSELECT 1;\n```'} />)
  expect(container.textContent).toContain('sql')
  expect(container.querySelectorAll('span.text-accent').length).toBeGreaterThan(0)
  unmount()

  const { container: c2 } = render(<RichText text={'```brainfuck\n+++[>+<]\n```'} />)
  expect(c2.querySelector('span.text-accent')).toBeNull()
  expect(c2.querySelector('span.italic')).toBeNull()
  expect(c2.querySelector('pre')?.textContent).toBe('+++[>+<]')
})

test('未标注语言的代码块：不猜语法，原样呈现且无标签', () => {
  const { container } = render(<RichText text={'```\nlet x = 1; // 不是 js 就不按 js 处理\n```'} />)
  expect(container.querySelector('span.text-accent')).toBeNull()
  expect(container.querySelector('pre')?.textContent).toBe('let x = 1; // 不是 js 就不按 js 处理')
})

test('未闭合围栏也不炸：内容原样落到代码块里', () => {
  const { container } = render(<RichText text={'```java\nint x = 1;\n'} />)
  // 围栏未闭合时，末行的空行也属于代码块（splitBlocks 的既有语义）
  expect(container.querySelector('pre')?.textContent).toBe('int x = 1;\n')
})
