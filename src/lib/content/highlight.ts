/**
 * 代码块语法着色纯核（零依赖、零 IO）：把源码切成带语义类别的片段，交给 RichText 上色。
 *
 * 为什么不引第三方高亮器：RichText 的基调是「零依赖极简 Markdown 子集」，一个
 * highlight.js/shiki 会把客户端包体积与一整套外来主题色板一起拖进来，而本项目
 * 的色板是定稿的（荧光黄是唯一强调色，mark.* 已被判分语义占走）。这里只覆盖
 * 面试题解实际出现的语言，行为可穷举、可单测。
 *
 * 铁律一：**无损**——所有 piece.text 拼接必须逐字节等于输入（测试有穷举断言）。
 * 铁律二：**未知语言一律原样返回单块 plain**，绝不在不认识的语法上瞎猜
 * （宁可不上色，也不能把正文里的撇号当成字符串起点吞掉半屏内容）。
 */

export type TokenKind = 'plain' | 'comment' | 'string' | 'number' | 'keyword'
export type Token = { text: string; kind: TokenKind }

type Profile = {
  keywords: ReadonlySet<string>
  /** SQL 这类关键字大小写不敏感 */
  caseInsensitive: boolean
  lineComments: readonly string[]
  blockComments: readonly (readonly [string, string])[]
  quotes: readonly string[]
  /** 反引号可跨行（JS/TS 模板串） */
  multilineBacktick: boolean
  /** Java 系注解 @Override 视作关键字上色 */
  annotations: boolean
  /** Python 三引号串（可跨行） */
  tripleQuotes: boolean
}

function kw(words: string): ReadonlySet<string> {
  return new Set(words.trim().split(/\s+/))
}

const JAVA_KEYWORDS = kw(`
  abstract assert boolean break byte case catch char class const continue default do double else
  enum extends final finally float for goto if implements import instanceof int interface long
  native new package private protected public return short static strictfp super switch
  synchronized this throw throws transient try void volatile while var record sealed yield
  true false null
`)

const JS_KEYWORDS = kw(`
  const let var function return if else for while do switch case break continue new delete typeof
  instanceof in of class extends super this import export from default async await yield try catch
  finally throw void null undefined true false interface type enum implements public private
  protected readonly static as satisfies keyof declare namespace abstract get set never unknown any
`)

const GO_KEYWORDS = kw(`
  break case chan const continue default defer else fallthrough for func go goto if import
  interface map package range return select struct switch type var nil true false
`)

const RUST_KEYWORDS = kw(`
  fn let mut pub use struct enum impl trait match if else loop while for in return self Self crate
  mod ref as where dyn unsafe async await static const move true false Some None Ok Err
`)

const C_KEYWORDS = kw(`
  auto break case char const continue default do double else enum extern float for goto if int long
  register return short signed sizeof static struct switch typedef union unsigned void volatile while
  class namespace template public private protected virtual override new delete nullptr true false
  using try catch throw constexpr bool this inline explicit friend operator typename
`)

const SQL_KEYWORDS = kw(`
  select from where insert into values update set delete create table index alter drop join inner
  left right full outer cross on group by order having limit offset union all distinct as and or not
  null is in exists between like count sum avg min max begin commit rollback transaction primary key
  foreign references unique default explain analyze with window over partition desc asc int bigint
  varchar text char timestamp boolean jsonb json uuid decimal numeric date time interval truncate
  cascade using when then else end case if grant revoke vacuum concurrent materialized view
`)

const PY_KEYWORDS = kw(`
  and as assert async await break class continue def del elif else except finally for from global if
  import in is lambda None nonlocal not or pass raise return True False try while with yield self
`)

/** shell：只收「语言关键字 + 内建命令」——刻意不列外部命令，免得变成任意清单 */
const SH_KEYWORDS = kw(`
  if then else elif fi for in do done while until case esac function return local export unset
  source exit shift eval exec set read echo printf cd pwd test declare readonly trap wait
`)

const JSON_KEYWORDS = kw(`true false null`)
const YAML_KEYWORDS = kw(`true false null yes no on off`)

/** 各语言的通用骨架（C 系：// 与 /* *\/ 注释 + 单双引号） */
function cLike(over: Partial<Profile>): Profile {
  return {
    keywords: C_KEYWORDS,
    caseInsensitive: false,
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    quotes: ['"', "'"],
    multilineBacktick: false,
    annotations: false,
    tripleQuotes: false,
    ...over,
  }
}

const PROFILES: Record<string, Profile> = {
  java: cLike({ keywords: JAVA_KEYWORDS, annotations: true }),
  js: cLike({ keywords: JS_KEYWORDS, quotes: ['"', "'", '`'], multilineBacktick: true }),
  go: cLike({ keywords: GO_KEYWORDS }),
  rust: cLike({ keywords: RUST_KEYWORDS }),
  c: cLike({}),
  sql: {
    keywords: SQL_KEYWORDS, caseInsensitive: true,
    lineComments: ['--'], blockComments: [['/*', '*/']], quotes: ['"', "'"],
    multilineBacktick: false, annotations: false, tripleQuotes: false,
  },
  python: {
    keywords: PY_KEYWORDS, caseInsensitive: false,
    lineComments: ['#'], blockComments: [], quotes: ['"', "'"],
    multilineBacktick: false, annotations: false, tripleQuotes: true,
  },
  shell: {
    keywords: SH_KEYWORDS, caseInsensitive: false,
    lineComments: ['#'], blockComments: [], quotes: ['"', "'"],
    multilineBacktick: false, annotations: false, tripleQuotes: false,
  },
  json: {
    keywords: JSON_KEYWORDS, caseInsensitive: false,
    lineComments: [], blockComments: [], quotes: ['"'],
    multilineBacktick: false, annotations: false, tripleQuotes: false,
  },
  yaml: {
    keywords: YAML_KEYWORDS, caseInsensitive: false,
    lineComments: ['#'], blockComments: [], quotes: ['"', "'"],
    multilineBacktick: false, annotations: false, tripleQuotes: false,
  },
  html: {
    keywords: kw(''), caseInsensitive: false,
    lineComments: [], blockComments: [['<!--', '-->']], quotes: ['"', "'"],
    multilineBacktick: false, annotations: false, tripleQuotes: false,
  },
}

/** 别名 → 档案 id（围栏里写 js/ts/py/sh/c++ 都能认；认不出就不上色） */
const ALIASES: Record<string, string> = {
  java: 'java', kt: 'java', kotlin: 'java', scala: 'java',
  js: 'js', javascript: 'js', jsx: 'js', ts: 'js', typescript: 'js', tsx: 'js', node: 'js',
  go: 'go', golang: 'go',
  rs: 'rust', rust: 'rust',
  c: 'c', h: 'c', cpp: 'c', cc: 'c', hpp: 'c', cxx: 'c', csharp: 'c', cs: 'c',
  sql: 'sql', postgres: 'sql', postgresql: 'sql', mysql: 'sql', plpgsql: 'sql', psql: 'sql',
  py: 'python', python: 'python', python3: 'python',
  sh: 'shell', bash: 'shell', shell: 'shell', zsh: 'shell', console: 'shell', terminal: 'shell',
  json: 'json', jsonc: 'json',
  yml: 'yaml', yaml: 'yaml',
  html: 'html', xml: 'html', vue: 'html', svg: 'html',
}

/** 语言是否被识别（RichText 据此决定要不要显示语言标签） */
export function isKnownLanguage(lang: string): boolean {
  return ALIASES[lang.trim().toLowerCase()] !== undefined
}

function isIdStart(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$' || c === '@'
}
function isIdCont(c: string): boolean {
  return isIdStart(c) || (c >= '0' && c <= '9')
}
function isDigit(c: string): boolean {
  return c >= '0' && c <= '9'
}

/** 字符串扫描：转义跳过；非跨行类型在换行处收尾（未闭合也如实截断，无损优先） */
function scanString(code: string, i: number, quote: string, multiline: boolean): number {
  let j = i + 1
  while (j < code.length) {
    const c = code[j]!
    if (c === '\\') { j += 2; continue }
    if (c === quote) return j + 1
    if (c === '\n' && !multiline) return j
    j++
  }
  return j
}

/** 数字扫描：支持 0x/0b 进制、下划线分隔、小数、科学计数、L/f/d 后缀 */
function scanNumber(code: string, i: number): number {
  // 进制前缀：只有 0x/0b 才允许吃 a-f（否则 123abc 这类会被整段吞成数字）
  if (code[i] === '0' && /[xXbBoO]/.test(code[i + 1] ?? '')) {
    let j = i + 2
    while (j < code.length && (isDigit(code[j]!) || /[a-fA-F_]/.test(code[j]!))) j++
    return j
  }
  let j = i
  while (j < code.length && (isDigit(code[j]!) || code[j] === '_' || code[j] === '.')) j++
  // 科学计数 e/E 必须后跟数字或符号，才认定为指数部分
  if (/[eE]/.test(code[j] ?? '') && /[0-9+-]/.test(code[j + 1] ?? '')) {
    j += 2
    while (j < code.length && isDigit(code[j]!)) j++
  }
  if (/[LlFfDd]/.test(code[j] ?? '')) j++   // 123L / 1.5f / 2d
  return j > i ? j : i + 1
}

/**
 * 源码 → 着色片段。相邻同类别片段已合并（少 DOM 节点）。
 * 任何输入都不会抛错；未知语言返回整块 plain。
 */
export function tokenize(code: string, lang: string): Token[] {
  if (code === '') return []
  const profile = PROFILES[ALIASES[lang.trim().toLowerCase()] ?? '']
  if (profile === undefined) return [{ text: code, kind: 'plain' }]

  const out: Token[] = []
  const push = (text: string, kind: TokenKind): void => {
    if (text === '') return
    const last = out[out.length - 1]
    if (last !== undefined && last.kind === kind) last.text += text
    else out.push({ text, kind })
  }

  let i = 0
  while (i < code.length) {
    // 1) 三引号串（Python docstring）——必须先于单引号判定
    if (profile.tripleQuotes) {
      const tq = code.startsWith('"""', i) ? '"""' : code.startsWith("'''", i) ? "'''" : null
      if (tq !== null) {
        const end = code.indexOf(tq, i + 3)
        const stop = end === -1 ? code.length : end + 3
        push(code.slice(i, stop), 'string')
        i = stop
        continue
      }
    }
    // 2) 块注释（未闭合则吃到文尾，与编辑器行为一致）
    const block = profile.blockComments.find(([open]) => code.startsWith(open, i))
    if (block !== undefined) {
      const [open, close] = block
      const end = code.indexOf(close, i + open.length)
      const stop = end === -1 ? code.length : end + close.length
      push(code.slice(i, stop), 'comment')
      i = stop
      continue
    }
    // 3) 行注释（不含换行符，换行留给 plain）
    const line = profile.lineComments.find(lc => code.startsWith(lc, i))
    if (line !== undefined) {
      const nl = code.indexOf('\n', i)
      const stop = nl === -1 ? code.length : nl
      push(code.slice(i, stop), 'comment')
      i = stop
      continue
    }
    // 4) 字符串
    const ch = code[i]!
    if (profile.quotes.includes(ch)) {
      const stop = scanString(code, i, ch, ch === '`' && profile.multilineBacktick)
      push(code.slice(i, stop), 'string')
      i = stop
      continue
    }
    // 5) 数字
    if (isDigit(ch)) {
      const stop = scanNumber(code, i)
      push(code.slice(i, stop), 'number')
      i = stop
      continue
    }
    // 6) 标识符 → 关键字判定（大小写按语言档案）
    if (isIdStart(ch)) {
      let j = i + 1
      while (j < code.length && isIdCont(code[j]!)) j++
      const word = code.slice(i, j)
      const hit = profile.keywords.has(profile.caseInsensitive ? word.toLowerCase() : word)
      push(word, hit || (profile.annotations && word.startsWith('@')) ? 'keyword' : 'plain')
      i = j
      continue
    }
    // 7) 其余单字符（相邻合并成段）
    push(ch, 'plain')
    i++
  }
  return out
}
