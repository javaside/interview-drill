# AGENTS.md — 给编码代理的项目指南

按知识块组织的后端面试题库 + 为「面试当天记忆峰值」优化的复习排期。Next.js 15 App Router + React 19 + TypeScript（strict）+ drizzle-orm + PostgreSQL + Tailwind，pnpm 单仓。已上线生产：https://xibaojun.com/drill。

## 常用命令

```bash
pnpm dev            # 开发服务器（http://localhost:3000/drill，basePath 见下）
pnpm build          # 生产构建
pnpm test           # 全量测试（PGlite 进程内 DB，不需要真 PG）
pnpm test:watch
pnpm typecheck      # tsc --noEmit，strict + noUncheckedIndexedAccess

pnpm content:new    # 新建题卡脚手架
pnpm content:audit  # 内容审计（写卡后必跑）
pnpm content:upsert # content/ → DB upsert（需 DATABASE_URL，tsx 不读 .env，要内联或先 export）
pnpm review:pairs   # 要点互斥审核
pnpm invite:new N [备注]   # 铸造邀请码（读 .env.local）
```

**改完代码的验收标准：`pnpm typecheck && pnpm test` 全绿。** 应用运行需要真 PG + `drizzle-kit migrate`（见 README 快速开始）；测试完全不需要。

## 架构铁律

依赖严格单向 **`src/app → src/server → src/lib`**：

- **`src/lib/` 纯核，零 IO**，全部可单测：`scheduler/`（冲刺排期，非通用 SM-2/FSRS）、`options/`（干扰项抽取）、`entitlement/`（免费=2块/付费=全量）、`mastery/`、`billing/`、`content/`（题卡解析）、`base-path.ts`。
- **`src/server/` 编排层**：纯核注入 IO。**SQL 只允许出现在 `src/server/db/adapters.ts`**。业务错误直接 `throw new Error('中文消息')`，路由薄壳用 `errorResponse()` 转 400 + `{error}`，客户端 `readJson` 透传到 `role=alert`——不要自己发明错误协议。
- **`src/app/` 薄壳**：server component 直接调 server 层函数（不经 HTTP），RSC 边界只传可序列化 payload，绝不传 deps。页面均 `force-dynamic`。路由：`/` 刷题（匿名=落地页 Landing）、`/practice` 自由刷、`/learn` 学习目录、`/map` 知识地图、`/settings`、`/upgrade` 兑换/购买、`/q/[id]` 公开题目页、`/signin`、`/backstage` 管理员铸码后台。
- **`src/client/`**：浏览器 API 客户端 + 离线引擎（IndexedDB 队列 + 重连回放）。
- **`content/`**：题库源文件（Markdown + front matter），`大类/知识块/ULID.md`，进 Git 不进 CMS；岗位包在 `content/tracks/*.yml`。
- **`drizzle/`**：drizzle-kit 生成的迁移，测试（PGlite）与生产同源跑同一批文件。

vitest 双 project：`node`（`tests/**/*.test.ts`，纯核单测 + PGlite 集成）与 `jsdom`（`tests/app/**/*.test.tsx`，组件测试）。新文件放错 project 就不会被跑到。

## 高频坑（都真实踩过）

1. **basePath='/drill'**：`Link`/`redirect()`/`router.push` 自动补前缀——目标给裸路径（手动 withBase 会叠成 `/drill/drill/`）。不带前缀的：裸 fetch（`src/client/api.ts` 已统一 withBase）、next-auth 客户端（根布局 SessionProvider basePath）、`pages.signIn` 显式 `/drill/signin`、signOut 的 callbackUrl。
2. **CLI 用 tsx 跑不读 `.env*`**：环境变量内联 `DATABASE_URL=... pnpm content:upsert` 或 `--env-file-if-exists=.env.local`。
3. **server/lib 内相对导入带 `.js` 后缀**（ESM 风格）；Next 的 webpack 靠 `next.config.ts` 的 extensionAlias 映射回 `.ts`——别改这个约定。
4. **每日容量的任何新入口必须先校验 ≥1 的整数**：容量 0/小数曾把 buildDailyPayload 重排打进死循环挂死 worker。
5. **免费墙必须服务端校验**：API 直调（绕过 UI）不能写坏数据——`applyBlockSelection` 直写 freeBlockIds 曾无校验，令 entitlementOf 在别处抛异常。
6. **content-upsert 的要点 tombstone 用单 JSON 数组参数 + unnest**：平铺参数会随库增长撞 PG/PGlite 参数上限。
7. 全站没有 `useSession` 消费者：SessionProvider（根布局 `AuthBridge`）唯一职责是给 next-auth 客户端下发 basePath；登录态由各 server component 用 `getServerSession` 自取后往下传。

## 题卡内容规范（v2，用户实测验证）

- 正文分「入门版」（零基础类比 + 术语映射「白话（术语名）」+ 末尾术语速查行）与「进阶版」，二者用 `<!--advanced-->` 分隔——**分隔符必须写全**，少个 `--` 不报错，进阶内容会静默混进入门版。
- 正文 `**` 与反引号必须配对（奇数即被 parse 拒）；扩 markdown 支持前先用解析器穷举内容语法面（`split*.ts`），别靠脑内枚举——表格、斜体都这样漏过。
- **atomic 卡只写 1 条要点**（多要点改 enumeration，否则第二条只学不考）；enumeration 块池下界 12，每块至少 5 张卡才够；sequence 卡要点 text 不得自带顺序标号（「第N步」会被 checkSequenceKeyPointText 拒）；judgment 卡要 conclusion。
- 要点文本避开「等」字（审计 KP5 连「等待/幂等」都拒，用「候/同值/排队/重复执行」替代）；块名避开「基础/进阶/其他/高频」（VAGUE_BLOCK_WORDS）。
- YAML 双引号内不能嵌英文双引号（改中文「」）。批量生成用 Python 三引号 + `kp()`/`emit()` 函数模板，别手拼转义。
- **扩产流程照旧**：python 模板 → `pnpm content:audit` → `DATABASE_URL=... pnpm content:upsert` → `pnpm test` → commit。改了 content/ 记得生产也要重跑 content:upsert。

## 产品定稿决策（用户拍板过，不要翻案重做）

- **勾选集 = 排期范围，所见即所得**：回放、排期（buildDailyPayload 按 selectionBlockIds 过滤）、复活三处同一口径 = 勾选集本身，**空即空，无任何隐藏兜底**。岗位是快速勾题手段不是视野概念。
- **岗位 chips 多选，点选即生效并自动保存**（连点排队串行、末次生效）；**逐块手动勾选才手动保存**（出未保存提示）。岗位高亮从勾选集实时推导，无独立状态——localStorage 持久化与 tab 过滤两个方案都已实现后被用户否决废弃，别再走回头路。
- **浏览零门槛、动作时刻要身份**：匿名可看首页落地页/地图/公开题，动真格（刷题/设置）才要登录；`/settings` 仍整页 redirect。
- **算法是参谋不是门卫**：用户主权优先（想刷哪刷哪/全部再来一遍/再练错题常驻入口）；先学后练（学习页教材在前）。
- **判分必须与展示同卷**（variantAt seed）；判分改动要覆盖四种卡型（同构守卫 `tests/app/scoring-isomorphic.test.tsx`——曾因只造 enumeration 卡漏掉三连 bug）。
- **付费模型：排期免费、题量付费**。解锁现实通道是邀请码（invite_codes 只存哈希，兑换原子占码防双花，`/backstage` 管理员白名单 fail-closed）。免费用户导航常驻「解锁」chip 是最新拍板（推翻了 spec §10.1 旧守卫）；刷题主循环绝不打断。
- 设置页黑话清零：临时加密→面试冲刺、就绪日→目标日期（可选）、每日容量→每天刷几题。

## 设计语言（定稿，commit ad79622）

「图纸蓝 + 荧光笔」：`#0F1826` 图纸蓝底 + 坐标纸网格，荧光黄 `#FACC15` 唯一强调色（语义=划重点：选中黄底扫过、`::selection` 黄、导航压黄线）；去衬线黑体标题；hero-first；动效克制（只留 hover/active，禁满屏 reveal/fade-up）；CTA 结果化（「提交」→「交卷」）。禁 AI 视觉指纹（cream+terracotta、near-black+acid-green、宽距大写眉标、按钮尾随箭头等）。用户对视觉极敏感且不愿做设计决策——设计判断由 agent 全权负责，交付结果而不是让用户选参数。

## Git 约定

- Conventional commits，中文描述 + 补充说明正文，如 `feat(settings): 岗位 chips 点选即生效——勾哪题首页刷哪题`。
- 不主动 push；提交信息如实写动机与验证方式（浏览器实测/测试 N → M）。

## 部署与生产

- **`docs/deploy.md` 是唯一权威**（xibaojun.com/drill，systemd + nginx 反代 127.0.0.1:8300）。日常升级：rsync → 服务器 `pnpm install --frozen-lockfile && pnpm build` → `drizzle-kit migrate` + `content:upsert`（content 有变更必须重跑）→ `systemctl restart` → 健康检查 `/drill/api/health`。
- 与同域老站共存：**drill 全站独占 `/drill` 前缀，绝不用根路径或裸 `/api`**（曾抢走老站登录接口）；nginx 配置改前先备份、`nginx -t` 通过再 reload。
- 生产 env 文件（`.env.production.local`）不在 git，人工保管；DB 迁移不可自动回滚，重大变更前先 pg_dump。

## 其他文档

- 设计 spec：`docs/superpowers/specs/2026-09-15-interview-drill-design.md`（注意其中部分决策已被后续用户拍板推翻，以本文件和 git log 为准）
- 路线图/实施计划/评审记录：`docs/superpowers/`
