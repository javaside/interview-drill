# 贡献指南

感谢你愿意为这个项目出力！这是一个中文后端面试题库 + 记忆排期产品，贡献分三类：**加题卡**（最欢迎）、**改代码**、**报问题**。

## 快速上手

```bash
pnpm install
pnpm test        # PGlite 进程内 DB，不需要真 PostgreSQL
pnpm typecheck
```

**验收标准：`pnpm typecheck && pnpm test` 全绿。** PR 会自动跑这两项（`.github/workflows/content.yml`，改动 `content/`、`src/lib/content/`、`tools/` 时触发，含跨提交 id 守卫）。

## 加题卡（内容贡献）

题库源文件在 `content/<大类>/<知识块>/<ULID>.md`（Markdown + front matter），进 Git 不进 CMS。

### 流程

1. `pnpm content:new <blockId> [cardType]` 生成脚手架（cardType：`enumeration | comparison | sequence | judgment | atomic`）
2. 填写 front matter 与正文
3. `pnpm content:audit` 审计——**写卡后必跑**
4. 新卡会带来大量「要点 × 目标题」未判定组合，audit 会指名报错；此时**维护者**需要跑 `pnpm content:exclusion --judge`（调 LLM 判定，仅维护者执行）→ `--apply`（账本写回）转绿。贡献者提交前如遇此报错，属正常现象，交给维护者处理即可
5. 提 PR，`git diff` 里应只有题卡 `.md` 文件

### 题卡规范要点（完整规范见 `AGENTS.md` 与既有卡示例）

- 正文分「入门版」（零基础类比 + 术语映射 + 末尾术语速查行）与「进阶版」，用 `<!--advanced-->` 分隔——**分隔符必须写全**，少个 `--` 不报错但进阶内容会静默混进入门版
- **atomic 卡只写 1 条要点**（多要点改 enumeration）；sequence 卡要点 text 不得自带「第 N 步」序号；judgment 卡 front matter 必填 `conclusion`
- 要点文本避开承载词（「等 / 多种 / 一系列 / 若干 / 诸如 / 各种」——连「等待 / 幂等」都会命中，用「候 / 同值 / 排队 / 重复执行」替代）
- YAML 双引号内不能嵌英文双引号（改用中文「」）
- 正文 `**` 与反引号必须配对（奇数个会被解析器拒绝）

### 示例代码（可选加分项）

每张 java 大类的卡可以配一个可运行演示类，放在[示例代码仓 interview-code](https://github.com/javaside/interview-code)（一题一类，头 Javadoc 标注题卡 ULID）。维护者跑 `pnpm demo:sync` 把它快照进 `content/`。

## 改代码

- TypeScript strict（`noUncheckedIndexedAccess`），Conventional commits 中文描述
- 依赖铁律：`src/app → src/server → src/lib` 单向；**SQL 与 fs 只出现在 `src/server/`**，`src/lib/` 零 IO 全部可单测
- server/lib 内相对导入带 `.js` 后缀（ESM 风格，`next.config.ts` 的 extensionAlias 映射回 `.ts`，别改这个约定）
- 新测试落点：纯核/集成 → `tests/**/**.test.ts`（node project）；组件 → `tests/app/**/*.test.tsx`（jsdom project）——放错 project 不会被跑到
- 提交信息如实写动机与验证方式（如「测试 N → M 全绿」「浏览器实测」）

## 报问题

开 issue 请带上：复现步骤、期望与实际、（代码问题）控制台输出。内容纠错（题卡事实性错误）特别欢迎，请注明出处（官方文档/规范章节链接）。

## 行为准则

保持专业与友善；对题卡内容的学术性分歧，以官方文档与可验证来源为准。
