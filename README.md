# interview-drill

按知识块组织的后端面试题库 + 为**面试当天记忆峰值**优化的复习排期。

程序员准备面试时，八股文「看了就忘」：面试题仓库（JavaGuide 等）只解决内容从哪来，不解决怎么记住；通用记忆软件（Anki）有算法但没内容，且算法为终身记忆而非短期冲刺优化——答对就翻倍间隔，一道卡会被排到面试之后。

本产品把两者合起来：

```
设定就绪日 → 知识地图勾选知识块 → 按每日可消化量收窄排期 → 刷题
→ 就绪日当天所有题处于记忆峰值 → 转入维持模式等面试
```

- **目标用户**：准备后端面试的程序员（第一版聚焦 Java 方向）
- **判分方式**：多选题 + 客观判分——要点本身就是选项，干扰项从同知识块其他题的要点池动态抽取（判分客观、单卡 15-25 秒、干扰项零内容成本）
- **离线可用**：PWA，离线刷题重连后回放同步
- **付费模型**：排期免费、题量付费——免费用户选 2 个知识块享完整功能，一次性买断解锁全量（当前为 ¥129 占位价，上线前定）

## 快速开始

前提：Node.js + pnpm，一个 PostgreSQL 实例（应用运行需要真 PG；测试用进程内 PGlite 不需要）。

```bash
pnpm install

# 1. 起 PG（示例：Docker）并建库
docker run -d --name interview-drill-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=drill -p 5432:5432 postgres:16

# 2. 应用迁移（用容器内的 psql，宿主机无需安装）
docker exec -i interview-drill-pg psql -U postgres -d drill -v ON_ERROR_STOP=1 < drizzle/0000_init.sql
docker exec -i interview-drill-pg psql -U postgres -d drill -v ON_ERROR_STOP=1 < drizzle/0001_polite_proudstar.sql

# 3. 灌入题库内容（CLI 用 tsx 运行，不读 .env，环境变量需内联或先 export）
DATABASE_URL=postgresql://postgres:dev@localhost:5432/drill pnpm content:upsert

# 4. 配置环境变量：复制模板并填入（.env.local 不进 git；AUTH_SECRET 用 openssl rand -base64 32 生成）
cp .env.example .env.local

# 5. 启动
pnpm dev   # → http://localhost:3000
```

验证：先访问 `/api/health` 确认 DB 连通；GitHub OAuth App 回调地址填 `http://localhost:3000/api/auth/callback/github`。

### 环境变量

| 变量 | 用途 | 必需 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接串（应用 + content CLI） | ✅ |
| `AUTH_SECRET` | NextAuth 签名密钥 | ✅ |
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth 登录 | 登录必需 |

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
```

## 架构

依赖严格单向 `app → server → lib`：

- **`src/lib/` 纯核**（零 IO，全部可单测）
  - `scheduler/` 冲刺排期与维持模式（面试当天峰值优化，非通用 SM-2/FSRS）
  - `options/` 干扰项抽取（分层比例、互斥过滤、付费墙边界、可复现随机源注入）
  - `entitlement/` 权限纯逻辑（free=选中 2 块 / paid=全量，锁题量不锁功能）
  - `mastery/` 掌握度 · `billing/` 订单状态机（迁移合法性/履约幂等/金额校验）
  - `content/` 题卡源文件解析
- **`src/server/` 编排层**（注入 IO 的纯核 + `db/adapters.ts`——SQL 只出现在这里）
  - `queue`（今日队列）、`review`（判分）、`sync`（离线回放）、`settings`、`map`（知识地图）
  - `billing.ts` 履约纯核（下单/回调履约/幂等）+ `billing-gateway.ts`（`PaymentGateway` 接口，fake 网关；真实微信/支付宝适配器待商户资质就绪后注册）
- **`src/app/` 薄壳**：App Router 页面与 API routes（`/` 刷题、`/map` 地图、`/settings`、`/upgrade` 购买页、`/q/[id]` 公开题目页）
- **`src/client/`**：浏览器 API 客户端与离线引擎（IndexedDB 队列 + 重连回放）
- **`content/`**：题库源文件（Markdown + front matter，进 Git 不进 CMS；`大类/知识块/ULID.md`）
- **`tools/`**：内容生产工具链（脚手架、审计、互斥审核），独立于生产应用
- **`drizzle/`**：drizzle-kit 生成的迁移（测试与生产同源）

## 测试

vitest 双 project：`node`（纯核单测 + PGlite 集成测试）与 `jsdom`（组件测试）。集成测试用 PGlite 跑真实迁移文件建表，与生产同源；当前 335 个测试全绿。

## 付费与当前边界

- 转化入口唯一（§10.1）：产品内付费提示只出现在知识地图未解锁块 → `/upgrade` 购买页，刷题主循环绝不打断
- 履约幂等：支付回调重复投递安全（幂等键 = 订单状态）；金额由服务端 `PRICE_CENTS` 决定，webhook 验签是唯一安全边界
- **轨道外待办**：境内收款资质链条（营业执照 → ICP 备案 → 商户号，线下串行动作）、真实微信/支付宝网关适配器（接口位已留好）、价格数字（当前 `PRICE_CENTS = 12900` 为占位）

## 文档

- 设计文档（spec）：`docs/superpowers/specs/2026-09-15-interview-drill-design.md`
- 路线图：`docs/superpowers/ROADMAP.md`
- 实施计划：`docs/superpowers/plans/`（内容工具链 → 排期 → 干扰项/掌握度 → server 层 → UI → 支付）
- 评审记录：`docs/superpowers/reviews/`
