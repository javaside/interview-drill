import { tokenize, isKnownLanguage } from '../../../src/lib/content/highlight.js'
import type { Token, TokenKind } from '../../../src/lib/content/highlight.js'

/** 某类别的片段文本（按出现顺序） */
function listOf(tokens: Token[], kind: TokenKind): string[] {
  return tokens.filter(t => t.kind === kind).map(t => t.text)
}
function textOf(tokens: Token[], kind: TokenKind): string {
  return listOf(tokens, kind).join('')
}
function kinds(tokens: Token[]): string {
  return tokens.map(t => t.kind).join(',')
}
/** 无损断言：拼接必须逐字节等于输入，且无空片段 */
function expectLossless(code: string, lang: string): Token[] {
  const tokens = tokenize(code, lang)
  expect(tokens.map(t => t.text).join('')).toBe(code)
  for (const t of tokens) expect(t.text.length).toBeGreaterThan(0)
  return tokens
}

const CASES: Array<[string, string]> = [
  ['java', 'public class A {\n  // 注释\n  int x = 0x1F;\n  String s = "a\\"b";\n}'],
  ['sql', "SELECT id FROM t -- 行注释\nWHERE name = 'x' /* 块\n注释 */ AND n > 3.14"],
  ['js', 'const s = `多行\n模板`;\n/* 块 */ if (a === "q") {}\nlet n = 1_000e3;'],
  ['ts', 'type T = { a?: string }; // c\nconst f = (x: number) => x ?? 0;'],
  ['python', 'def f(x):\n    """doc\n    string"""\n    # 注释\n    return True'],
  ['shell', 'if [ -z "$HOME" ]; then\n  echo \'hi\' # 注释\nfi'],
  ['go', 'func main() {\n\tdefer f()\n\t// c\n\tvar s = "x"\n}'],
  ['rust', 'let mut v: Vec<i32> = vec![1, 2]; // c\nmatch x { Some(y) => y, None => 0 }'],
  ['c', 'int main(void) { /* c */ return 0; }'],
  ['json', '{"a": 1, "b": true, "c": null}'],
  ['yaml', '# 注释\nname: "值"\nport: 8080\nenabled: true'],
  ['html', '<!-- 注释 -->\n<div class="a">文本</div>'],
  ['', 'code with no lang and 中文 ` 撇号 \' 单引号'],
  ['未知语言xyz', 'SELECT * FROM t; -- 不上色'],
]

test('无损不变量：任何语言下片段拼接都逐字节等于输入，且无空片段', () => {
  for (const [lang, code] of CASES) expectLossless(code, lang)
})

test('无损不变量：对抗输入（未闭合/转义/换行符/Unicode）也不丢字节', () => {
  const adversarial: Array<[string, string]> = [
    ['java', '未闭合字符串 "abc'],
    ['java', '未闭合块注释 /* abc'],
    ['js', '尾反斜杠 \\'],
    ['sql', "SELECT 'it''s'"],
    ['js', 'a\r\nb\rc'],
    ['python', '"""未闭合三引号'],
    ['java', '中文 🎉 emoji 混排 // 注释'],
    ['json', ''],
    ['sql', '--'],
    ['js', '`'],
  ]
  for (const [lang, code] of adversarial) expectLossless(code, lang)
})

test('未知语言 / 空语言：整块 plain，绝不在不认识的语法上瞎猜', () => {
  const unknown = tokenize("it's a trap -- not code", 'brainfuck')
  expect(unknown).toEqual([{ text: "it's a trap -- not code", kind: 'plain' }])

  const noLang = tokenize('plain text with 中文', '')
  expect(noLang).toEqual([{ text: 'plain text with 中文', kind: 'plain' }])

  expect(tokenize('', 'java')).toEqual([])
  expect(isKnownLanguage('java')).toBe(true)
  expect(isKnownLanguage('Java')).toBe(true)
  expect(isKnownLanguage('c++')).toBe(false)   // 围栏正则捕获不到，写出来也不认
  expect(isKnownLanguage('brainfuck')).toBe(false)
})

test('java：关键字 / 注解 / 字符串 / 数字 / 注释 各自归类', () => {
  const tokens = expectLossless(
    'public int x = 42;\n@Transactional\nString s = "hi"; // 说明', 'java',
  )
  expect(listOf(tokens, 'keyword')).toEqual(['public', 'int', '@Transactional'])
  expect(textOf(tokens, 'string')).toBe('"hi"')
  expect(textOf(tokens, 'number')).toBe('42')
  expect(textOf(tokens, 'comment')).toBe('// 说明')
})

test('sql：关键字大小写不敏感，双横线注释与单引号串', () => {
  const tokens = expectLossless("select id from t where a = 'x' -- 尾部说明", 'sql')
  expect(listOf(tokens, 'keyword')).toEqual(['select', 'from', 'where'])
  expect(textOf(tokens, 'string')).toBe("'x'")
  expect(textOf(tokens, 'comment')).toBe('-- 尾部说明')
  expect(textOf(tokens, 'plain')).toContain('id')   // 裸标识符不当关键字
})

test('python：三引号串跨行、# 注释、True 是该语言的关键字', () => {
  const tokens = expectLossless('"""doc\nline"""\n# c\nx = True\ny = true', 'python')
  expect(textOf(tokens, 'string')).toBe('"""doc\nline"""')
  expect(textOf(tokens, 'comment')).toBe('# c')
  expect(listOf(tokens, 'keyword')).toEqual(['True'])
})

test('js：模板串可跨行，普通串遇换行即收（不吞下文）', () => {
  const tpl = expectLossless('`a\nb` + x', 'js')
  expect(textOf(tpl, 'string')).toBe('`a\nb`')

  const broken = expectLossless('"未闭合\n下一行是普通代码', 'js')
  expect(textOf(broken, 'string')).toBe('"未闭合')
  expect(textOf(broken, 'plain')).toContain('下一行是普通代码')
})

test('shell：# 是注释而不是标识符的一部分', () => {
  const tokens = expectLossless('echo "$HOME" # 注释\nif true; then :; fi', 'shell')
  expect(textOf(tokens, 'comment')).toBe('# 注释')
  expect(listOf(tokens, 'keyword')).toEqual(['echo', 'if', 'then', 'fi'])
  expect(textOf(tokens, 'string')).toBe('"$HOME"')
})

test('json：true/false/null 是关键字，且 # 不是注释（不吞行）', () => {
  const tokens = expectLossless('{"a": true, "b": null, "c": 1}', 'json')
  expect(listOf(tokens, 'keyword')).toEqual(['true', 'null'])
  expect(textOf(tokens, 'number')).toBe('1')

  const withHash = expectLossless('{"a": 1} # 不是注释', 'json')
  expect(textOf(withHash, 'comment')).toBe('')
  expect(textOf(withHash, 'plain')).toContain('# 不是注释')
})

test('数字：进制 / 下划线 / 小数 / 指数 / 后缀，且 123abc 不被整段吞成数字', () => {
  expect(textOf(expectLossless('int a = 0x1F;', 'java'), 'number')).toBe('0x1F')
  expect(textOf(expectLossless('let a = 1_000;', 'js'), 'number')).toBe('1_000')
  expect(textOf(expectLossless('let a = 1.5e3;', 'js'), 'number')).toBe('1.5e3')
  expect(textOf(expectLossless('long a = 123L;', 'java'), 'number')).toBe('123L')

  const nasty = expectLossless('123abc', 'java')
  expect(textOf(nasty, 'number')).toBe('123')
  expect(textOf(nasty, 'plain')).toBe('abc')
})

test('相邻同类片段合并：输出里没有相邻同类别片段（少 DOM 节点）', () => {
  for (const [lang, code] of CASES) {
    const tokens = tokenize(code, lang)
    for (let i = 1; i < tokens.length; i++) {
      expect(tokens[i]!.kind).not.toBe(tokens[i - 1]!.kind)
    }
  }
  // 连写标识符之间的空白不能被并进关键字
  expect(kinds(tokenize('if (a) { return 1; }', 'java')))
    .toBe('keyword,plain,keyword,plain,number,plain')
})
