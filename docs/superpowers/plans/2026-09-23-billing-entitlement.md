# 支付与权限升级实现计划（计划 5 · 工程部分）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现「排期免费、题量付费」的付费解锁工程闭环——订单状态机纯核、订单持久化、支付回调履约（free→paid 权限升级，幂等）、支付网关薄壳、知识地图上的唯一转化入口与购买页；把已就绪的 `lib/entitlement` 权限位接到真实的下单-支付-解锁链路上。

**Architecture:** 支付逻辑下沉到**可单测的纯核**：订单状态机（`src/lib/billing`，零 IO 纯函数——状态迁移 + 幂等判定 + 金额校验）与履约入口（`src/server/billing.ts`，注入 IO 的纯核 + adapters）。React/HTTP/支付 SDK 是薄壳。**真实支付网关（微信支付/支付宝）通过 `PaymentGateway` 接口抽象注入**——纯核只认接口，测试注入假网关，生产注入真实 SDK 适配器。权限升级复用 `lib/entitlement` 的 `makePaidEntitlement`，落库只改 `user_settings.plan`。依赖仍严格单向 `app → server → lib`；转化入口只在知识地图一处（§10.1）。

**Tech Stack:** Next.js 15（App Router）· drizzle（新增 `orders` 表 + 迁移）· pglite 进程内集成测试 · vitest 双 project（node 纯核/集成 + jsdom 组件）· `ulid`（订单 id）。复用 `lib/entitlement`（`makePaidEntitlement`/`Plan`）、`lib/scheduler`（`LocalDate`）。**不引任何支付 SDK 到纯核**——网关是接口，真实 SDK 适配器在薄壳层，且其接入依赖境内收款资质（见 Scope Check）。

**Spec:** `docs/superpowers/specs/2026-09-15-interview-drill-design.md` §10（第一版做付费解锁）、§10.1（免费=完整 2 块 / 付费=全量、锁题量不锁功能、一次性买断对标 129 元、知识地图唯一转化入口、**产品内不得第二处付费提示尤其不在刷题中打断**）、§7（依赖方向 `app→server→lib`）。ROADMAP「五个实施计划」计划 5、「下一步」①。

**上游依赖:** 计划 4a（`src/server`：`user_settings.plan`/`free_block_ids` 已落库、`entitlementOf(row)`、drizzle 迁移机制、`requireUserId` 鉴权、pglite 测试夹具 `createTestDb`）、计划 3（`lib/entitlement`：`Plan`/`Entitlement`/`makePaidEntitlement`/`entitledBlockIds` 已就绪）、计划 4b（知识地图 `KnowledgeMap`/`BlockMapEntry`：未解锁块已渲染真实题数、是转化入口的挂载点）。当前基线 `main` 320 单测全绿。

---

## Scope Check（本计划边界——哪些能 TDD 落地、哪些是外部阻塞）

计划 5 在 spec 里横跨两个性质截然不同的部分，本计划**只做能在无外部凭据下 TDD 落地的工程闭环**，其余如实标注为轨道外阻塞项，不在本计划的 task 里假装完成：

**✅ 本计划交付（纯核 + 集成测试 + 组件测试全可本地验证）：**
- 订单状态机纯核（创建→待支付→已支付/失败/过期，非法迁移拒绝，回调幂等）
- `orders` 表 + 迁移 + 订单持久化 adapters
- 支付回调履约：`free→paid` 权限升级落库，幂等（同一订单重复回调不重复授权）
- 支付网关**接口抽象** + create-order / webhook 路由薄壳（注入假网关测通）
- 知识地图唯一转化入口 + 购买页（§10.1：产品内仅此一处付费提示）
- 端到端：未解锁块 → 下单 → 回调履约 → 解锁全量（地图/队列反映）

**⛔ 轨道外阻塞项（本计划不实现，只留接口位与说明）：**
- **境内收款资质链条**（营业执照 → ICP 备案 → 公安备案 → 微信支付/支付宝商户号）——纯日历动作、4-8 周串行、零工程人力（spec §10「⚠️ 必须第一周启动」）。本会话无法执行，须线下启动。
- **真实微信/支付宝 SDK 对接与公网 webhook 联调**——依赖上面的商户号/API 密钥/回调公网域名，无凭据无法联调。本计划把网关做成 `PaymentGateway` 接口，真实适配器（`WechatPayGateway`/`AlipayGateway`）留待资质就绪后在薄壳层补，**不进纯核、不阻塞本计划测试**。
- **具体价格数字**——spec §10.1「具体价格上线前再定」。本计划用占位常量 `PRICE_CENTS`，标注为上线前替换。

> 结论：本计划是**支付闭环的可测骨架**。它让「下单→履约→解锁」全链路在假网关下端到端跑通、纯核全绿，真实网关只需在资质到位后实现一个接口适配器即可插入，无需改动任何纯核或测试。

## Global Constraints（每个任务隐含遵守）

- **转化入口唯一（§10.1）**：付费提示只在知识地图未解锁块 + 其跳转的购买页。刷题主循环、屏①②、设置屏、公开题目页**绝不**出现购买 CTA。违反即缺陷。
- **锁题量不锁功能（§10.1）**：`free` 与 `paid` 的差别只有 `entitledBlockIds` 的返回范围（免费=选中 2 块、付费=全部）。排期、维持模式、同步、地图可见性对两者完全一致——已由 `lib/entitlement` 保证，本计划不得新增任何"付费才能用某功能"的分支。
- **履约幂等（关键）**：支付回调可能重复投递（网关重试）。同一 `orderId` 的成功回调**第二次及以后必须是 no-op**——不重复改 plan、不报错、照常回 2xx（否则网关会一直重投）。幂等键 = `orders` 表的订单状态（已 paid 的订单再收成功回调直接返回）。
- **金额在服务端校验**：订单金额由服务端 `PRICE_CENTS` 决定，**绝不信任客户端传入的金额**。create-order 不接受金额参数；webhook 校验回调金额与订单记录一致，不一致则拒绝履约并留痕。
- **webhook 无 session 鉴权、靠签名校验**：`/api/billing/webhook` 是网关服务器回调，没有用户 session。它**不得**用 `requireUserId`；改用 `gateway.verifySignature(rawBody, headers)` 验签（接口抽象，假网关测试注入恒真/恒假）。**这是无 session 的对外写端点——安全边界是签名，签名失败必须拒绝履约。**
- **paid 幂等语义**：已 `paid` 用户再次下单/回调不报错也不"降级"，`makePaidEntitlement` 幂等；`free_block_ids` 在升级为 paid 时清空（paid 恒空数组，与 `lib/entitlement` 契约一致）。
- **纯核纪律**：状态机/履约判定放 `src/lib/billing`（零 IO）与 `src/server/billing.ts`（注入 IO）；SQL 只在 adapters、HTTP 只在 route。支付 SDK 不出现在纯核。
- **依赖白名单**：本计划**不新增** runtime 依赖（网关是自定义接口，真实 SDK 待资质后另议）。沿用 4a/4b 白名单。
- 组件测试用 jsdom；`import` 带 `.js` 后缀；tsconfig `strict + noUncheckedIndexedAccess`。

## 文件结构

| 文件 | 职责 |
|---|---|
| `src/lib/billing/order.ts` | 订单状态机纯核：`OrderStatus`、`transition()`、`canFulfill()`、`PRICE_CENTS`（零 IO） |
| `src/server/db/schema.ts` | 追加 `orders` 表（Task 2） |
| `drizzle/*.sql` | drizzle-kit 生成的迁移（Task 2） |
| `src/server/db/adapters.ts` | 追加 `insertOrder`/`loadOrder`/`markOrderPaid`/`upgradeToPaid`（Task 2/3） |
| `src/server/billing.ts` | 履约纯核入口：`createOrder`/`fulfillOrder`（注入 IO），`PaymentGateway` 接口（Task 3/4） |
| `src/server/deps.ts` | 追加 `billingDepsOf(db, userId)`（Task 3） |
| `src/app/api/billing/create-order/route.ts` | 下单薄壳（`requireUserId`，Task 4） |
| `src/app/api/billing/webhook/route.ts` | 回调薄壳（验签，无 session，Task 4） |
| `src/app/upgrade/page.tsx` + `UpgradeView.tsx` | 购买页（唯一转化入口的落地页，Task 5） |
| `src/app/map/KnowledgeMap.tsx` | 未解锁块链到 `/upgrade`（Task 5 改） |
| `src/client/api.ts` | 追加 `postCreateOrder`（Task 5） |
| `tests/billing/order.test.ts` | 状态机纯核单测（node project） |
| `tests/server/billing.test.ts` | 履约集成测试（node/pglite） |
| `tests/app/upgrade.test.tsx` + `knowledge-map.test.tsx` | 购买页 + 地图入口组件测（jsdom） |

---

### Task 1: 订单状态机纯核 `src/lib/billing/order.ts`

**Files:**
- Create: `src/lib/billing/order.ts`
- Test: `tests/billing/order.test.ts`（node project）

**Interfaces:**
- Produces:
  - `type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired'`（下单即 `pending`，无独立 `created`——建单与发起支付是同一步）
  - `const PRICE_CENTS = 12900`（占位，对标 129 元；**上线前替换**）
  - `type OrderEvent = 'paid' | 'failed' | 'expired'`
  - `transition(current: OrderStatus, event: OrderEvent): OrderStatus`——合法：`pending→paid|failed|expired`；从终态（paid/failed/expired）再收**同类**事件是 no-op（返回原状态，幂等）；终态收**异类**事件抛错（如已 paid 收 failed）。
  - `fulfillmentDecision(current: OrderStatus): 'fulfill' | 'already' | 'reject'`——`pending`→`fulfill`（首次履约）、`paid`→`already`（幂等 no-op）、`failed|expired`→`reject`。
  - `assertAmount(cents: number): void`——`cents !== PRICE_CENTS` 抛错（服务端金额校验，webhook 用）。

- [ ] **Step 1: 失败测试 `tests/billing/order.test.ts`**

```ts
import { transition, fulfillmentDecision, assertAmount, PRICE_CENTS } from '../../src/lib/billing/order.js'

test('合法迁移：pending → paid/failed/expired', () => {
  expect(transition('pending', 'paid')).toBe('paid')
  expect(transition('pending', 'failed')).toBe('failed')
  expect(transition('pending', 'expired')).toBe('expired')
})

test('幂等：已 paid 再收 paid 事件 → 仍 paid（no-op，网关重投）', () => {
  expect(transition('paid', 'paid')).toBe('paid')
})

test('非法迁移：已 paid 收 failed → 抛错（状态冲突）', () => {
  expect(() => transition('paid', 'failed')).toThrow()
})

test('fulfillmentDecision：pending=fulfill、paid=already、failed/expired=reject', () => {
  expect(fulfillmentDecision('pending')).toBe('fulfill')
  expect(fulfillmentDecision('paid')).toBe('already')
  expect(fulfillmentDecision('failed')).toBe('reject')
  expect(fulfillmentDecision('expired')).toBe('reject')
})

test('assertAmount：金额不等于 PRICE_CENTS 抛错', () => {
  expect(() => assertAmount(PRICE_CENTS)).not.toThrow()
  expect(() => assertAmount(1)).toThrow()
})
```

- [ ] **Step 2: 运行确认失败**：`pnpm vitest run tests/billing/order.test.ts`（模块不存在 → FAIL）
- [ ] **Step 3: 实现 `src/lib/billing/order.ts`**（`transition` 用 `pending` 起点的白名单 map + 终态同类事件 no-op、异类抛错；`fulfillmentDecision` 三分支；`assertAmount` 比较常量）
- [ ] **Step 4: 验证**：`pnpm vitest run tests/billing/order.test.ts`（5 passed）；`pnpm typecheck`
- [ ] **Step 5: Commit**：`git add -A && git commit -m "feat(billing): 订单状态机纯核——迁移合法性/履约幂等决策/金额校验"`

---

### Task 2: `orders` 表 + 迁移 + 订单持久化 adapters

**Files:**
- Modify: `src/server/db/schema.ts`（追加 `orders` 表）
- Generate: `drizzle/*.sql`（`pnpm exec drizzle-kit generate`）
- Modify: `src/server/db/adapters.ts`（`insertOrder`/`loadOrder`）
- Test: `tests/server/billing.test.ts`（node/pglite）

**Interfaces:**
- Consumes: `SqlRunner`（adapters 现有类型别名）、`OrderStatus`（Task 1）。
- Produces:
  - schema `orders`：`id`(text pk, ULID)、`userId`(text→users.id)、`amountCents`(integer)、`status`(text default `'pending'`)、`gateway`(text，`'wechat'|'alipay'|'fake'`)、`gatewayTxnId`(text nullable)、`createdAt`(timestamptz default now)、`paidAt`(timestamptz nullable)；`index('orders_user_idx').on(userId)`。
  - `type OrderRow = { id: string; userId: string; amountCents: number; status: OrderStatus; gateway: string; gatewayTxnId: string | null; paidAt: Date | null }`
  - `insertOrder(db: SqlRunner, o: { id: string; userId: string; amountCents: number; gateway: string }): Promise<void>`（status 用默认 `pending`）
  - `loadOrder(db: SqlRunner, orderId: string): Promise<OrderRow | null>`（不存在→null）

- [ ] **Step 1: 追加 schema `orders`**（`src/server/db/schema.ts` 末尾，import 已含 `pgTable/text/integer/timestamp/index`）

```ts
export const orders = pgTable('orders', {
  id: text('id').primaryKey(),                    // ULID
  userId: text('user_id').notNull().references(() => users.id),
  amountCents: integer('amount_cents').notNull(),
  status: text('status').notNull().default('pending'),   // OrderStatus
  gateway: text('gateway').notNull(),             // 'wechat' | 'alipay' | 'fake'
  gatewayTxnId: text('gateway_txn_id'),           // 网关流水号，回调时写
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
}, t => [index('orders_user_idx').on(t.userId)])
```

- [ ] **Step 2: 生成迁移**：`pnpm exec drizzle-kit generate`（在 `drizzle/` 下产出新 SQL；测试 `createTestDb` 从此目录 `migrate()` 建表——与生产同源）。确认新 `.sql` 含 `CREATE TABLE "orders"`。
- [ ] **Step 3: 失败测试 `tests/server/billing.test.ts`**（先只测订单往返）

```ts
import { ulid } from 'ulid'
import { sql } from 'drizzle-orm'
import { createTestDb } from './helpers.js'
import { insertOrder, loadOrder } from '../../src/server/db/adapters.js'

async function seedUser(db: never) {
  await (db as { execute: (q: unknown) => Promise<unknown> }).execute(
    sql`insert into users (id, github_id) values ('u1','gh1')`)
  await (db as { execute: (q: unknown) => Promise<unknown> }).execute(
    sql`insert into user_settings (user_id) values ('u1')`)
}

test('insertOrder/loadOrder 往返：新单 status=pending、金额落库、不存在→null', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const id = ulid()
    await insertOrder(t.db as never, { id, userId: 'u1', amountCents: 12900, gateway: 'fake' })
    const row = (await loadOrder(t.db as never, id))!
    expect(row.status).toBe('pending')
    expect(row.amountCents).toBe(12900)
    expect(row.userId).toBe('u1')
    expect(await loadOrder(t.db as never, 'nope')).toBeNull()
  } finally { await t.pg.close() }
})
```

- [ ] **Step 4: 确认失败 → 实现 adapters**（`insertOrder` = `db.insert(orders).values(...)`；`loadOrder` = `db.select().from(orders).where(eq(orders.id, orderId)).limit(1)`，映射到 `OrderRow`，空→null；`status`/`gateway` 按 text 读回，`OrderRow.status` 断言为 `OrderStatus`）
- [ ] **Step 5: 验证**：`pnpm vitest run tests/server/billing.test.ts`（1 passed）；`pnpm typecheck`
- [ ] **Step 6: Commit**：`git add -A && git commit -m "feat(billing): orders 表 + 迁移 + 订单持久化 adapters"`

---

### Task 3: 履约纯核 `fulfillOrder` + 权限升级 adapters（core，幂等）

**Files:**
- Modify: `src/server/db/adapters.ts`（`markOrderPaid`/`upgradeToPaid`）
- Create: `src/server/billing.ts`（`PaymentGateway` 接口、`createOrder`、`fulfillOrder`）
- Test: `tests/server/billing.test.ts`（追加履约用例）

**Interfaces:**
- Consumes: `transition`/`fulfillmentDecision`/`assertAmount`/`PRICE_CENTS`/`OrderEvent`（Task 1）、`insertOrder`/`loadOrder`（Task 2）、`SqlRunner`。
- Produces:
  - adapters `markOrderPaid(db, orderId, gatewayTxnId): Promise<void>`（`update orders set status='paid', gateway_txn_id=?, paid_at=now()`）
  - adapters `upgradeToPaid(db, userId): Promise<void>`（`update user_settings set plan='paid', free_block_ids='[]'::jsonb`——paid 恒空数组，与 `lib/entitlement` 契约一致）
  - `interface PaymentGateway { createPayment(o: { orderId: string; amountCents: number }): Promise<{ payParams: unknown }>; verifySignature(rawBody: string, headers: Record<string, string>): boolean; parseCallback(rawBody: string): { orderId: string; amountCents: number; gatewayTxnId: string; event: OrderEvent } }`
  - `type BillingDeps = { db: SqlRunner; gateway: PaymentGateway }`
  - `createOrder(deps, userId: string, gateway: string): Promise<{ orderId: string; amountCents: number; payParams: unknown }>`（铸 ULID → `insertOrder`(pending, `PRICE_CENTS`) → `gateway.createPayment` → 返回）
  - `fulfillOrder(deps, cb: { orderId: string; amountCents: number; gatewayTxnId: string; event: OrderEvent }): Promise<{ outcome: 'fulfilled' | 'already' | 'rejected' }>`——`loadOrder`；无单→`rejected`；按 `fulfillmentDecision(row.status)`：`already`→直接返回（幂等 no-op，不重复升级）；`reject`→`rejected`；`fulfill`→`event!=='paid'` 则 `markOrder`+返回 rejected（失败/过期事件）、`event==='paid'` 则 `assertAmount(cb.amountCents)` 校验 → `markOrderPaid` → `upgradeToPaid` → `fulfilled`。金额不符时 `assertAmount` 抛错，履约中止、订单不置 paid（留痕在异常，交 route 记录）。

- [ ] **Step 1: 履约测试 `tests/server/billing.test.ts`（追加，复用 Task 2 的 seedUser）**

```ts
import { createOrder, fulfillOrder, type PaymentGateway } from '../../src/server/billing.js'
import { loadSettings } from '../../src/server/db/adapters.js'

const fakeGateway: PaymentGateway = {
  createPayment: async () => ({ payParams: { fake: true } }),
  verifySignature: () => true,
  parseCallback: () => ({ orderId: 'x', amountCents: 12900, gatewayTxnId: 't', event: 'paid' }),
}

test('履约首次：pending → paid，用户升级 paid 且 free_block_ids 清空', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const { orderId, amountCents } = await createOrder({ db: t.db as never, gateway: fakeGateway }, 'u1', 'fake')
    const r = await fulfillOrder({ db: t.db as never, gateway: fakeGateway }, { orderId, amountCents, gatewayTxnId: 't1', event: 'paid' })
    expect(r.outcome).toBe('fulfilled')
    const s = await loadSettings(t.db as never, 'u1')
    expect(s.plan).toBe('paid')
    expect(s.freeBlockIds).toEqual([])
  } finally { await t.pg.close() }
})

test('重复回调幂等：同一订单第二次 → already，plan 仍 paid，不报错', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const { orderId, amountCents } = await createOrder({ db: t.db as never, gateway: fakeGateway }, 'u1', 'fake')
    const deps = { db: t.db as never, gateway: fakeGateway }
    await fulfillOrder(deps, { orderId, amountCents, gatewayTxnId: 't1', event: 'paid' })
    const r2 = await fulfillOrder(deps, { orderId, amountCents, gatewayTxnId: 't1', event: 'paid' })
    expect(r2.outcome).toBe('already')
    expect((await loadSettings(t.db as never, 'u1')).plan).toBe('paid')
  } finally { await t.pg.close() }
})

test('金额不符：assertAmount 抛错，履约中止，plan 不变', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const { orderId } = await createOrder({ db: t.db as never, gateway: fakeGateway }, 'u1', 'fake')
    await expect(fulfillOrder({ db: t.db as never, gateway: fakeGateway },
      { orderId, amountCents: 1, gatewayTxnId: 't1', event: 'paid' })).rejects.toThrow()
    expect((await loadSettings(t.db as never, 'u1')).plan).toBe('free')
  } finally { await t.pg.close() }
})

test('未知订单 → rejected', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const r = await fulfillOrder({ db: t.db as never, gateway: fakeGateway },
      { orderId: 'nope', amountCents: 12900, gatewayTxnId: 't', event: 'paid' })
    expect(r.outcome).toBe('rejected')
  } finally { await t.pg.close() }
})
```

- [ ] **Step 2: 确认失败 → 实现 adapters + `billing.ts`**（`markOrderPaid`/`upgradeToPaid` 走 drizzle update；`fulfillOrder` 按 Interfaces 的分支实现，`already` 分支在 `markOrderPaid` 前 return）
- [ ] **Step 3: 验证**：`pnpm vitest run tests/server/billing.test.ts`（5 passed：Task2 的 1 + 本任务 4）；`pnpm typecheck`
- [ ] **Step 4: Commit**：`git add -A && git commit -m "feat(billing): 履约纯核 fulfillOrder + 权限升级——free→paid 幂等、金额校验"`

---

### Task 4: 网关选择器 + webhook 处理纯核 + 路由薄壳

**Files:**
- Create: `src/server/billing-gateway.ts`（`fakeGateway`、`gatewayOf`）
- Modify: `src/server/billing.ts`（`handleWebhook` 可测纯核）
- Modify: `src/server/deps.ts`（`billingDepsOf`）
- Create: `src/app/api/billing/create-order/route.ts`、`src/app/api/billing/webhook/route.ts`
- Test: `tests/server/billing.test.ts`（追加 `handleWebhook` 两例）

**Interfaces:**
- Consumes: `fulfillOrder`/`BillingDeps`/`PaymentGateway`（Task 3）、`requireUserId`（`auth-config.js`）、`getDb`（`db/client.js`）。
- Produces:
  - `src/server/billing-gateway.ts`：`fakeGateway: PaymentGateway`（`verifySignature` 恒 true、`parseCallback` 解析 JSON body）；`gatewayOf(name: string): PaymentGateway`——**当前恒返回 `fakeGateway`**，并在注释标注「真实 `WechatPayGateway`/`AlipayGateway` 待商户资质就绪后在此注册」。
  - `billing.ts` 追加 `handleWebhook(deps: BillingDeps, rawBody: string, headers: Record<string, string>): Promise<{ status: number; body: unknown }>`——`deps.gateway.verifySignature(rawBody, headers)` 为 false → `{ status: 401, body: { error: 'bad signature' } }`（**拒绝履约**）；true → `parseCallback` → `fulfillOrder` → `{ status: 200, body: { outcome } }`（履约异常如金额不符由 route 捕获记录后仍回非 2xx 让网关重投）。
  - `deps.ts` `billingDepsOf(db: SqlRunner, gatewayName = 'fake'): BillingDeps`（`{ db, gateway: gatewayOf(gatewayName) }`）。
  - create-order route（`requireUserId` → `createOrder(billingDepsOf(getDb()), userId, 'fake')` → json）；webhook route（**无 `requireUserId`**：`const raw = await request.text()`，headers 转对象 → `handleWebhook` → `NextResponse.json(body, { status })`）。

- [ ] **Step 1: `handleWebhook` 测试 `tests/server/billing.test.ts`（追加）**

```ts
import { handleWebhook } from '../../src/server/billing.js'

const badSig: PaymentGateway = { ...fakeGateway, verifySignature: () => false }

test('webhook 验签失败 → 401，不履约', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const r = await handleWebhook({ db: t.db as never, gateway: badSig }, '{}', {})
    expect(r.status).toBe(401)
    expect((await loadSettings(t.db as never, 'u1')).plan).toBe('free')
  } finally { await t.pg.close() }
})

test('webhook 验签成功 → 履约 200，用户升级 paid', async () => {
  const t = await createTestDb()
  try {
    await seedUser(t.db as never)
    const { orderId, amountCents } = await createOrder({ db: t.db as never, gateway: fakeGateway }, 'u1', 'fake')
    const gw: PaymentGateway = { ...fakeGateway,
      parseCallback: () => ({ orderId, amountCents, gatewayTxnId: 't1', event: 'paid' }) }
    const r = await handleWebhook({ db: t.db as never, gateway: gw }, '{}', { sig: 'ok' })
    expect(r.status).toBe(200)
    expect((await loadSettings(t.db as never, 'u1')).plan).toBe('paid')
  } finally { await t.pg.close() }
})
```

- [ ] **Step 2: 确认失败 → 实现** `billing-gateway.ts`、`handleWebhook`、`billingDepsOf`、两个 route。**安全注记**：webhook 是无 session 的对外写端点，唯一防线是 `verifySignature`；实现真实网关时验签必须比对网关公钥/HMAC，不可跳过。
- [ ] **Step 3: 验证**：`pnpm vitest run tests/server/billing.test.ts`（7 passed）；`pnpm typecheck`；`pnpm exec next build 2>&1 | tail -3`（两个新 route 可构建）
- [ ] **Step 4: Commit**：`git add -A && git commit -m "feat(billing): 网关抽象 + webhook 验签履约纯核 + 下单/回调路由薄壳"`

---

### Task 5: 知识地图唯一转化入口 + 购买页 UI

**Files:**
- Modify: `src/client/api.ts`（`postCreateOrder`）
- Modify: `src/app/map/KnowledgeMap.tsx`（未解锁块链到 `/upgrade`）
- Create: `src/app/upgrade/page.tsx`、`src/app/upgrade/UpgradeView.tsx`
- Test: `tests/app/upgrade.test.tsx`；Modify: `tests/app/knowledge-map.test.tsx`（未解锁块入口改动）

**Interfaces:**
- Consumes: `Api`（`src/client/api.ts`）、`BlockMapEntry`（`server/map.ts`）、`PRICE_CENTS`（`lib/billing/order.js`）。
- Produces:
  - `api.ts`：`postCreateOrder(): Promise<{ orderId: string; amountCents: number; payParams: unknown }>`（`POST /api/billing/create-order`）。
  - `KnowledgeMap`：未解锁块由 4b 的 `<span data-testid="locked-block">{cardCount} 题</span>` 改为**包一层链到 `/upgrade` 的入口**——`<a href="/upgrade" data-testid="locked-block">{cardCount} 题 · 解锁</a>`。**仍是全页唯一 locked 入口**（§10.1）；解锁块入口不变（链到 `/?block`）。
  - `UpgradeView({ priceCents, api }: { priceCents: number; api?: Pick<Api, 'postCreateOrder'> })`（`'use client'`，`api` 省略默认 `browserApi()`）：展示价格 `¥{priceCents/100}`（一次性买断文案）、「立即解锁全部题库」按钮；点击 `await api.postCreateOrder()` 拿 `payParams` 后交给网关 SDK 拉起支付（假网关下仅置「支付发起中」态）。
  - `upgrade/page.tsx` server component：`<UpgradeView priceCents={PRICE_CENTS} />`（不传 api）。

- [ ] **Step 1: 购买页测试 `tests/app/upgrade.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpgradeView } from '../../src/app/upgrade/UpgradeView.js'

test('展示价格与一次性买断文案 + 解锁按钮', () => {
  render(<UpgradeView priceCents={12900} api={{ postCreateOrder: vi.fn() } as never} />)
  expect(screen.getByText(/¥\s*129/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /解锁/ })).toBeInTheDocument()
})

test('点击解锁调 postCreateOrder', async () => {
  const u = userEvent.setup()
  const postCreateOrder = vi.fn(async () => ({ orderId: 'o1', amountCents: 12900, payParams: {} }))
  render(<UpgradeView priceCents={12900} api={{ postCreateOrder } as never} />)
  await u.click(screen.getByRole('button', { name: /解锁/ }))
  expect(postCreateOrder).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: 地图入口测试 `tests/app/knowledge-map.test.tsx`（替换未解锁块那条）**

```tsx
test('未解锁块：显示「N 题」且是链到 /upgrade 的唯一转化入口', () => {
  render(<KnowledgeMap entries={entries} />)
  const b2 = screen.getByTestId('block-b2')
  expect(b2).toHaveTextContent('18 题')
  const locked = screen.getByTestId('locked-block')
  expect(locked).toHaveAttribute('href', '/upgrade')
  expect(screen.getAllByTestId('locked-block')).toHaveLength(1)   // 全页唯一
})
```

- [ ] **Step 3: 确认失败 → 实现**（`api.ts` 加 `postCreateOrder`；`KnowledgeMap` 未解锁分支换成 `<a href="/upgrade" data-testid="locked-block">`；`UpgradeView` `'use client'` + `useState` 发起态；`upgrade/page.tsx` server component）
- [ ] **Step 4: 验证**：`pnpm vitest run tests/app/upgrade.test.tsx tests/app/knowledge-map.test.tsx`（全绿）；全量 + typecheck；`next build`
- [ ] **Step 5: Commit**：`git add -A && git commit -m "feat(app): 知识地图唯一转化入口 → 购买页，一次性买断解锁"`

---

### Task 6: 端到端验收——未解锁 → 下单 → 回调履约 → 解锁全量

**Files:**
- Test: `tests/server/billing.test.ts`（追加端到端一例）

**Interfaces:**
- Consumes: `createOrder`/`handleWebhook`（Task 3/4）、`buildBlockMap`（`server/map.js`）、`mapDepsOf`（`deps.js`）。不产出新模块——本任务是「地图解锁位随履约翻转」的集成守卫。

- [ ] **Step 1: 端到端测试 `tests/server/billing.test.ts`（追加）**

```ts
import { buildBlockMap } from '../../src/server/map.js'
import { mapDepsOf } from '../../src/server/deps.js'

test('端到端：免费未解锁块 → 下单 → 回调履约 → 地图全量解锁', async () => {
  const t = await createTestDb()
  try {
    // 免费用户仅选 b1；b1/b2 各 1 张卡
    await t.db.execute(sql`insert into users (id, github_id) values ('u1','gh1')`)
    await t.db.execute(sql`insert into user_settings (user_id, free_block_ids) values ('u1', '["b1"]'::jsonb)`)
    await t.db.execute(sql`insert into blocks (id, name, category) values ('b1','MySQL','db'),('b2','Redis','db')`)
    await t.db.execute(sql`insert into cards (id, block_id, question, card_type, detail, follow_ups, applies_to, frequency)
      values ('b1-0','b1','q','enumeration','d','[]'::jsonb,'x','high'),
             ('b2-0','b2','q','enumeration','d','[]'::jsonb,'x','high')`)

    const before = await buildBlockMap(mapDepsOf(t.db as never, 'u1'))
    expect(before.find(e => e.blockId === 'b2')!.unlocked).toBe(false)

    const { orderId, amountCents } = await createOrder({ db: t.db as never, gateway: fakeGateway }, 'u1', 'fake')
    const gw: PaymentGateway = { ...fakeGateway,
      parseCallback: () => ({ orderId, amountCents, gatewayTxnId: 't1', event: 'paid' }) }
    const r = await handleWebhook({ db: t.db as never, gateway: gw }, '{}', { sig: 'ok' })
    expect(r.status).toBe(200)

    const after = await buildBlockMap(mapDepsOf(t.db as never, 'u1'))
    expect(after.find(e => e.blockId === 'b2')!.unlocked).toBe(true)   // paid 全解锁
    expect(after.every(e => e.unlocked)).toBe(true)
  } finally { await t.pg.close() }
})
```

- [ ] **Step 2: 确认失败 → 若失败回对应任务修**（不在本测试里打补丁；本任务是 Task 3/4 + 4b 地图的集成守卫）
- [ ] **Step 3: 验证**：`pnpm vitest run`（node + jsdom 全绿，总数 = 320 基线 + 本计划新增）；`pnpm typecheck`；`pnpm exec next build 2>&1 | tail -3`
- [ ] **Step 4: Commit**：`git add -A && git commit -m "test(billing): §10.1 端到端——下单→回调履约→地图全量解锁"`

---

## Self-Review（对着 spec 核过）

**Spec 覆盖：**
- §10「付费解锁：支付接入 + 权限位 + 地图转化入口」→ Task 1-4（支付+权限位）+ Task 5（地图入口）✓
- §10.1「排期免费、题量付费」「锁题量不锁功能」→ 全局约束（差别只在 `entitledBlockIds` 范围）+ Task 3（升级只改 plan）✓
- §10.1「一次性买断对标 129 元」→ `PRICE_CENTS=12900` + Task 5 买断文案 ✓
- §10.1「知识地图唯一转化入口、产品内不得第二处付费提示」→ 全局约束 + Task 5（locked-block 全页唯一、其余屏无 CTA）✓
- §10.1「免费=完整 2 块、paid free_block_ids 清空」→ Task 3 `upgradeToPaid` 清空 ✓
- §7「依赖方向 app→server→lib」→ 纯核纪律（状态机在 lib、履约在 server、SDK 在薄壳）✓
- §10「境内收款资质链条」→ Scope Check 明确标为轨道外阻塞，非工程 task ✓

**Placeholder 扫描：** `PRICE_CENTS` 是有意的占位常量（spec「价格上线前定」），已在 Scope Check 与代码注释标注「上线前替换」——非计划占位符，是被 spec 授权的待定值。真实网关适配器同理，Scope Check 已界定。其余步骤均含真实测试代码与实现指引。

**类型一致性：** `OrderStatus`/`OrderEvent`（Task 1）在 Task 2 `OrderRow`、Task 3 `fulfillOrder`、Task 4 `parseCallback` 一致；`PaymentGateway`（Task 3）在 Task 4 `handleWebhook`/`gatewayOf`、Task 5 假实现一致；`BillingDeps`（Task 3）在 Task 4 `billingDepsOf` 一致；`createOrder` 返回 `{orderId,amountCents,payParams}` 在 Task 5 `postCreateOrder` 一致。

**待接线尾注（非阻塞，记录在案）：**
- 真实 `WechatPayGateway`/`AlipayGateway`：实现 `PaymentGateway` 三方法（`createPayment` 调统一下单 API、`verifySignature` 验网关签名、`parseCallback` 解析回调报文），在 `gatewayOf` 注册。依赖商户资质，见 Scope Check。
- 订单过期清理（pending 超时置 expired）：可加一个定时 job 或懒判定，第一版不阻塞（用户重新下单即生成新单）。
- 退款：spec 未提，第一版不做。

---

## 执行交接

计划已保存到 `docs/superpowers/plans/2026-09-23-billing-entitlement.md`（Task 1-6）。两种执行方式：

1. **子代理驱动（推荐）** — 每个 task 派一个全新子代理实现，任务间双阶段评审。
2. **会话内执行** — 在本会话按 executing-plans 批量执行，带检查点评审。







