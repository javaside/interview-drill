# interview-drill

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE) [![content](https://github.com/javaside/interview-drill/actions/workflows/content.yml/badge.svg)](https://github.com/javaside/interview-drill/actions/workflows/content.yml)

**[线上体验 → xibaojun.com/drill](https://xibaojun.com/drill)** · 配套示例代码仓：[interview-code](https://github.com/javaside/interview-code)

按知识块组织的后端面试题库 + 为**面试当天记忆峰值**优化的复习排期。

程序员准备面试时，八股文「看了就忘」：面试题仓库（JavaGuide 等）只解决内容从哪来，不解决怎么记住；通用记忆软件（Anki）有算法但没内容，且算法为终身记忆而非短期冲刺优化——答对就翻倍间隔，一道卡会被排到面试之后。

本产品把两者合起来：

```
设定就绪日 → 知识地图勾选知识块 → 按每日可消化量收窄排期 → 刷题
→ 就绪日当天所有题处于记忆峰值 → 转入维持模式等面试
```

- **目标用户**：准备后端面试的程序员（当前 12 大类 81 块 404 卡，3 个岗位包：Java 后端 / 架构师 / Agent 开发）
- **判分方式**：客观判分——要点本身就是选项，干扰项从同知识块其他题的要点池动态抽取（判分客观、单卡 15-25 秒、干扰项零内容成本）。五种题型：多选（恒 9 选项）/ 对比 / 判断 / 排序 / 单选（恒 4 选项）
- **离线可用**：离线引擎（IndexedDB 本地队列 + 重连回放同步；PWA manifest/Service Worker 尚未接入）
- **配套可运行示例**：java 大类每题一个可运行 Demo 类（[interview-code](https://github.com/javaside/interview-code)），App 内复盘/学习页可直接阅读（Java 语法着色 + GitHub 外链），AI 问答也感知示例代码；公开题目页只放提示不放代码（不泄露付费要点）
- **付费模型**：排期免费、题量付费——免费用户选 2 个知识块享完整功能，**¥29 / 30 天通行证**解锁全量（`PASS_PRICE_CENTS` / `PASS_DAYS`，不自动续费，续期可叠加）；到期后有**宽限期**让已排的题跑完（冲刺跑到在期排期最后一天、常备模式 +14 天），权限判定看 `user_settings.paid_until`。在线支付上线前的现实解锁通道是**邀请码**（`/upgrade` 页兑换，同样发 30 天，管理后台 `/backstage` 铸码，见 docs/deploy.md）

## 快速开始

前提：Node.js + pnpm，一个 PostgreSQL 实例（应用运行需要真 PG；测试用进程内 PGlite 不需要）。

```bash
pnpm install

# 1. 起 PG（示例：Docker）并建库
docker run -d --name interview-drill-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=drill -p 5432:5432 postgres:16

# 2. 应用迁移（幂等，可重复执行；连接串从 DATABASE_URL 读，默认 localhost drill 库）
DATABASE_URL=postgresql://postgres:dev@localhost:5432/drill pnpm exec drizzle-kit migrate

# 3. 灌入题库内容（CLI 用 tsx 运行，不读 .env，环境变量需内联或先 export）
DATABASE_URL=postgresql://postgres:dev@localhost:5432/drill pnpm content:upsert

# 4. 配置环境变量：复制模板并填入（.env.local 不进 git；AUTH_SECRET 用 openssl rand -base64 32 生成）
cp .env.example .env.local

# 5. 启动
pnpm dev   # → http://localhost:3000/drill（整站挂 /drill 基路径）
```

验证：先访问 `/drill/api/health` 确认 DB 连通；GitHub OAuth App 回调地址填 `http://localhost:3000/drill/api/auth/callback/github`（须带 `/drill`），并在 `.env.local` 设 `NEXTAUTH_URL=http://localhost:3000/drill/api/auth`——next-auth v4 在未设该变量时按 `http://localhost:3000/api/auth` 拼回调，缺 `/drill` 会 404。

### 环境变量

| 变量 | 用途 | 必需 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接串（应用 + content CLI） | ✅ |
| `AUTH_SECRET` | NextAuth 签名密钥 | ✅ |
| `NEXTAUTH_URL` | NextAuth 基路径，dev 填 `http://localhost:3000/drill/api/auth`（缺了 GitHub 登录回调 404；生产在服务器 env 里配同名值） | 登录必需 |
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth 登录 | 登录必需 |
| `ADMIN_GITHUB_IDS` | `/backstage` 铸码后台的管理员白名单（GitHub 数字 id，逗号分隔；空 = 无人可进） | 可选 |

## 常用命令

```bash
pnpm dev            # 开发服务器
pnpm build          # 生产构建
pnpm test           # 全量测试（PGlite 进程内 DB，无需真 PG）
pnpm test:watch     # 测试 watch 模式
pnpm typecheck      # tsc --noEmit（strict + noUncheckedIndexedAccess）

pnpm content:new    # 新建题卡脚手架（tools/content-new）
pnpm content:audit  # 内容审计（tools/audit-cli）
pnpm content:upsert # content/ → DB upsert（需 DATABASE_URL）
pnpm review:pairs   # 要点互斥审核工具（tools/review，本地运行产 PR）
pnpm demo:sync      # 示例代码仓 → content/ 快照同步（含 manifest 产出）
```

## 架构

依赖严格单向 `app → server → lib`：

- **`src/lib/` 纯核**（零 IO，全部可单测）
  - `scheduler/` 冲刺排期与维持模式（面试当天峰值优化，非通用 SM-2/FSRS）
  - `options/` 干扰项抽取（分层比例、互斥过滤、付费墙边界、可复现随机源注入）
  - `entitlement/` 权限纯逻辑（free=选中 2 块 / paid=全量，锁题量不锁功能）
  - `mastery/` 掌握度 · `billing/` 订单状态机（迁移合法性/履约幂等/金额校验）
  - `content/` 题卡源文件解析
- **`src/server/` 编排层**（注入 IO 的纯核；**SQL 只出现在这一层，绝不下沉 lib/app**——主体在 `db/adapters.ts`，`content-upsert/`、`admin.ts`、`invite.ts`、`auth.ts` 各有少量事务内联 SQL）
  - `queue`（今日队列）、`review`（判分）、`sync`（离线回放）、`settings`、`map`（知识地图）
  - `billing.ts` 履约纯核（下单/回调履约/幂等）+ `billing-gateway.ts`（`PaymentGateway` 接口，fake 网关；真实微信/支付宝适配器待商户资质就绪后注册）
  - `invite.ts` 邀请码铸造/兑换（原子占码防双花）、`admin.ts` 后台白名单
- **`src/app/` 薄壳**：App Router 页面与 API routes（`/` 刷题·匿名=落地页、`/practice` 自由刷、`/learn` 学习目录、`/map` 地图、`/settings`、`/upgrade` 解锁/兑换、`/q/[id]` 公开题目页、`/signin` 登录页、`/backstage` 铸码后台）
- **`src/client/`**：浏览器 API 客户端与离线引擎（IndexedDB 队列 + 重连回放）
- **`content/`**：题库源文件（Markdown + front matter，进 Git 不进 CMS；`大类/知识块/ULID.md`）
- **`tools/`**：内容生产工具链（脚手架、审计、互斥审核），独立于生产应用
- **`drizzle/`**：drizzle-kit 生成的迁移（测试与生产同源）

## 测试

vitest 双 project：`node`（纯核单测 + PGlite 集成测试）与 `jsdom`（组件测试）。集成测试用 PGlite 跑真实迁移文件建表，与生产同源；当前 800+ 测试全绿（96 文件）。

## 付费与当前边界

- 转化入口：免费用户 NavBar 常驻「解锁」chip → `/upgrade` 解锁页（2026-09-30 拍板，取代 spec §10.1「导航绝不放付费入口」旧守卫——解锁页原本藏太深用户找不到）；知识地图未解锁块是第二入口；刷题主循环绝不打断
- **邀请码是当前唯一现实解锁通道**（在线支付未上线）：`/backstage` 后台或服务器 CLI 铸码（只存哈希），用户在 `/upgrade` 兑换；兑换原子占码防并发双花
- 履约幂等：支付回调重复投递安全（幂等键 = 订单状态）；金额由服务端 `PASS_PRICE_CENTS` 决定，webhook 验签是唯一安全边界
- **轨道外待办**：境内收款资质链条（营业执照 → ICP 备案 → 商户号，线下串行动作）、真实微信/支付宝网关适配器（接口位已留好）、价格数字复核（当前 `PASS_PRICE_CENTS = 2900` / 30 天，正式对外前再确认）

## 文档

- 设计文档（spec）：`docs/superpowers/specs/2026-09-15-interview-drill-design.md`
- 路线图：`docs/superpowers/ROADMAP.md`
- 实施计划：`docs/superpowers/plans/`（内容工具链 → 排期 → 干扰项/掌握度 → server 层 → UI → 支付）
- 评审记录：`docs/superpowers/reviews/`
- 自部署指南：`docs/deploy.md`（systemd + nginx 反代，敏感值为占位符，按自身环境替换）

## 贡献

欢迎加题卡、改代码、报问题——见 [CONTRIBUTING.md](./CONTRIBUTING.md)。加题卡是最高价值的贡献：题卡规范与内容工具链都在仓库里，`pnpm content:new` 起步。

## License

[MIT](./LICENSE) © 2026 javaside
