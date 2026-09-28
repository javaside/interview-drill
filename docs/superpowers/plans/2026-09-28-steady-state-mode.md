# 常备模式（随时可战）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让「无固定面试日」用户在维持模式下长期保持记忆（常备=滚动间隔复习），修复自动毕业/计划黑洞/新卡洪水三个缺口，接线 §5.8 临时加密。

**Architecture:** 不新建模式——维持模式已是常备模式，修的是它到不了用户手上的断点。全部改动在既有分层内：纯核兜底（transitionCard）+ adapters（reviveDoneCards）+ settings/queue 接线 + cram 新端点（纯核 cramForInterview 早已实现，零调用）。

**Tech Stack:** 沿用现有（TypeScript strict / drizzle sql 模板 / pglite 集成测试 / vitest 双 project）。零新依赖。

**Spec:** `docs/superpowers/specs/2026-09-15-interview-drill-design.md` §5.5/§5.7/§5.8（本计划 Task 5 落修订）。评审记录见会话（plan subagent 评审：修改后通过，意见已吸收）。

## Global Constraints

- plan-once 纪律不变；同日死循环红线不踩（兜底恒 +1 天起步，`buildQueue` 只收 `<0`/`===0`）
- `replanned` 与 `maintenanceAdvanced` 保持互斥（UI 契约，replay.ts 注释）
- cram 只重排选中块，其余块计划逐字节不变（§5.8 明文）
- 依赖方向 `app → server → lib`；SQL 只在 adapters；route 是薄壳
- §10.1：导航/主循环无付费文案；组件测试钩子（testid/文案/aria）不得破坏
- `ALGO_VERSION` bump v2（Task 5，spec §8.2 机制）

---

### Task 1: R-1 维持模式计划黑洞——设置变更不清空滚动计划

**Files:** Modify `src/server/settings.ts`；Test `tests/server/settings-blocks.test.ts`（追加）

**Interfaces:**
- Consumes: `applySettingsChange(deps, userId, next)`、`loadSettings`
- Produces: 行为变更——结果模式为 maintenance（readyByDate 为空或已过期）时跳过 `clearActivePlans`，返回 `replanned: 0`。

- [ ] **Step 1: 失败测试**（未设就绪日的用户改容量 → 已有滚动计划的卡的计划不被清空）：

```ts
test('常备模式（未设就绪日）改容量：不清空滚动计划', async () => {
  const t = await createTestDb()
  try {
    await seedUserWithBlocks(t.db)   // 现有 helper：user + b1 块 + 1 卡 + free_block_ids=["b1"]
    // 常备模式下刷一次卡 → 卡获得滚动计划 [today+1]
    await t.db.execute(sql`insert into card_state (user_id, card_id, phase, s_num, s_den, plan, phase_index, review_count)
      values ('u1','b1-0','learning',0,1,'["2026-09-29"]'::jsonb,0,1)`)
    const r = await applySettingsChange({ db: t.db as never, serverNowMs: NOW }, 'u1', { dailyCapacity: 30 })
    expect(r.replanned).toBe(0)      // 没有卡被重排
    const row = await t.db.execute<{ plan: string[] }>(sql`select plan from card_state where card_id = 'b1-0'`)
    expect(row.rows[0]!.plan).toEqual(['2026-09-29'])   // 滚动计划原样保留
  } finally { await t.pg.close() }
})
```

- [ ] **Step 2: 确认失败**（现状 replanned=1、plan 被清空）
- [ ] **Step 3: 实现**：`applySettingsChange` 在 `updateUserSettings` 后 `loadSettings` 判模式——`readyByDate === null || diffDays(readyByDate, localDateOf(serverNowMs, tz)) < 0` 时直接 `return { replanned: 0 }`（跳过 clearActivePlans 与重排装配），否则走原路径。注意 sprint 模式行为不变。
- [ ] **Step 4: 验证**：单文件测试绿 + `pnpm typecheck`
- [ ] **Step 5: Commit**：`fix(settings): 常备模式设置变更不清空滚动计划（R-1 黑洞）`

### Task 2: R-2 常备模式新卡限流——按 newPerDayOf 截断首曝

**Files:** Modify `src/lib/scheduler/schedule.ts`（maintenance 分支）；Test `tests/lib/scheduler/schedule.test.ts`（追加）

**Interfaces:**
- Consumes: `newPerDayOf(capacity)`（plan.ts）、`sortForScheduling`（types.ts）
- Produces: `schedule()` maintenance 分支 todayQueue 中「无计划新卡」数量 ≤ `newPerDayOf(dailyCapacity)`（确定性：sortForScheduling 前缀）。到期/逾期卡不受限。

- [ ] **Step 1: 失败测试**：容量 45（newPerDayOf=15），无就绪日，20 张新卡 → todayQueue 新卡数 = 15（非 20）。再测 3 张新卡 → 全进（3 ≤ 15，现有测试「3 张全进队」不破）。
- [ ] **Step 2: 确认失败**（现状 20 全进）
- [ ] **Step 3: 实现**：`buildQueue` 加可选参 `newCardLimit?: number`，收集 `plan.length === 0 && new` 的 due 项后截断前 `newCardLimit` 个；schedule 的 maintenance 分支传 `newPerDayOf(dailyCapacity)`，sprint 分支不传（错峰已由 firstExposureOffset 处理）。
- [ ] **Step 4: 验证**：scheduler 测试全绿（含既有「3 张全进队」）+ typecheck
- [ ] **Step 5: Commit**：`fix(scheduler): 常备模式新卡首曝按 newPerDayOf 限流（R-2 洪水）`

### Task 3: A 计划耗尽兜底——废除自动 done

**Files:** Modify `src/server/replay.ts`、`src/lib/scheduler/regenerate.ts`；Test `tests/server/replay.test.ts`（追加/改写）、`tests/lib/scheduler/regenerate.test.ts`（改写 done 用例）

**Interfaces:**
- Consumes: `maintenanceStep(k, ratio)`（regenerate.ts）
- Produces: `transitionCard` 在 nextPlan 为空时（mode 无关）走 `maintenanceStep(phaseIndex, score)` → `nextPlan = [ctx.today + step.nextInDays]`、`phaseIndex = step.k`、`maintenanceAdvanced = true`（与 replanned 互斥：兜底分支放在 mode 分支之后，若 replanned 已置 true 则不覆盖 flag，仅取计划）。`shouldMarkDone` 删除（死代码），transitionCard 不再产出 phase=done。

- [ ] **Step 1: 失败测试**：
  1. sprint + E=0 + 答错（score 0/5）→ outcome.nextReviewOffset === 1（明天再见）、`maintenanceAdvanced === true`、`replanned === false`（互斥契约）、state.phase === 'learning'
  2. sprint + 末项消费完 + 答对（score 5/5）→ nextReviewOffset === 3（k=1 进档 +3 天）、phase === 'learning'
  3. sprint + E>0 + 答错 → 原重排行为不变（replanned=true，阶梯计划）
  4. maintenance 分支行为不变（恒滚动）
- [ ] **Step 2: 确认失败**（1/2 现状是 done + null）
- [ ] **Step 3: 实现**：transitionCard 第 3 步重排/维持分支后加兜底：`if (nextPlan.length === 0) { const step = maintenanceStep(phaseIndex, score); phaseIndex = step.k; nextPlan = [ctx.today + step.nextInDays]; if (!replanned) maintenanceAdvanced = true }`；删除第 4 步 shouldMarkDone 调用；regenerate.ts 删 shouldMarkDone 导出。
- [ ] **Step 4: 验证**：replay/regenerate 测试全绿（改写引用 shouldMarkDone 的旧用例为「计划耗尽→滚动」断言）+ 集成测试 `tests/server/queue.test.ts` 相关 done 用例核对 + typecheck + 全量
- [ ] **Step 5: Commit**：`feat(scheduler): 计划耗尽自动落维持滚动——废除自动 done（临阵磨枪）`

### Task 4: B 存量 done 复活

**Files:** Modify `src/server/db/adapters.ts`（`reviveDoneCards`）、`src/server/settings.ts`（触发）；Test `tests/server/settings-blocks.test.ts`（追加）

**Interfaces:**
- Produces: `reviveDoneCards(db, userId, blockIds: readonly string[]): Promise<number>`——`update card_state set phase='learning' where user_id=? and phase='done' and card_id in (select id from cards where block_id in …)` returning 计数；`applySettingsChange` 在 sprint 路径 `clearActivePlans` 后调用（范围=当前 free_block_ids 或全量——paid 用户全块；用 loadSettings.freeBlockIds，paid 时传全部块 id 由调用方取 blocks 表）。phaseIndex 保留。

- [ ] **Step 1: 失败测试**：done 卡 + 用户设就绪日保存 → phase 变 learning、次日 buildDailyPayload 后有计划；paused 卡不被复活。
- [ ] **Step 2: 确认失败**（现状 done 不变）
- [ ] **Step 3: 实现** adapter + settings 接线（sprint 与 maintenance 两条路径都复活——常备用户也要救回 done 卡：maintenance 分支在 return 前调 reviveDoneCards）。
- [ ] **Step 4: 验证**：单文件绿 + typecheck + 全量
- [ ] **Step 5: Commit**：`feat(settings): 存量 done 卡在设置保存时复活重排`

### Task 5: ALGO_VERSION v2 + spec 修订

**Files:** Modify `src/server/version.ts`、`docs/superpowers/specs/2026-09-15-interview-drill-design.md`（§5.5/§5.8）

- [ ] **Step 1**: `ALGO_VERSION = 'v2'`（注释：计划耗尽→维持滚动，语义变更）
- [ ] **Step 2**: spec §5.5「计划项全部消费完（plan 为空）→ phase = done，退出队列」修订为「计划项全部消费完 → 自动转入 §5.7 维持滚动（答错次日 +1、答对按档位间隔）；phase=done 不再自动产生，仅存量兼容」。§5.8 追加注记：「cram 执行时将 readyByDate 置为面试前一天——这是 §5.5 条件 2 全局重排的显式豁免（只重排选中块）；面试日一过 R<0 自动回 §5.7」。
- [ ] **Step 3: 验证**：全量测试绿（version 变更可能影响断言 algo_version 的测试——核对改写）+ typecheck
- [ ] **Step 4: Commit**：`chore: ALGO_VERSION v2 + spec §5.5/§5.8 修订（计划耗尽→维持滚动）`

### Task 6: C 临时加密接线（§5.8）

**Files:** Create `src/server/cram.ts`、`src/app/api/cram/route.ts`；Modify `src/client/api.ts`（`postCram`）、`src/app/settings/SettingsForm.tsx`（UI）；Test `tests/server/cram.test.ts`（新）、`tests/app/settings-form.test.tsx`（追加）

**Interfaces:**
- Consumes: `cramForInterview(selected, states, examDate, today, capacity, reservedLoad)`（regenerate.ts）、`persistPlans`、`updateUserSettings`、`loadSettings`、`loadAllCards`、`entitlementOf`。
- Produces:
  - `applyCram(deps: ServerDeps, userId: string, req: { examDate: LocalDate; blockIds: string[] }): Promise<{ crammed: number; excluded: number }>`——校验（blockIds ⊆ 解锁块）→ 选中块卡（entitlement 过滤后按 blockId）→ `reservedLoadOf(states.filter(不在选中块))` → `cramForInterview` → **二次 prefixCheck**（含 excluded 旧计划占位，防静默超容，不过则缩 k 重试一次，再不过返回 crammed 但带告警计数）→ `persistPlans`（空 plans 不写行）→ `updateUserSettings(readyByDate = examDate - 1天)`。
  - route：`POST /api/cram`（requireUserId，body `{ examDate, blockIds }` → json）。
  - `api.postCram(body): Promise<{ crammed: number; excluded: number }>`。
  - SettingsForm：追加「临时加密」区块——面试日期 + 块多选（默认勾当前 selected）+ 提交按钮调 `api.postCram`，回显「已加密 N 张（M 张窗口不足）」。§10.1 无付费文案。

- [ ] **Step 1: 失败测试**（集成，pglite）：
  1. 常备用户（readyByDate=null）+ 2 块各 3 卡 + examDate=今天+4 → crammed>0、settings.readyByDate === examDate-1、选中块卡有阶梯计划、**未选中块卡计划逐字节不变**
  2. E<1（examDate=明天）→ crammed=0、excluded=全部、设置不动
  3. UI：渲染「临时加密」区块、提交调 postCram 一次
- [ ] **Step 2: 确认失败** → **Step 3: 实现** → **Step 4: 验证**（单文件 + 全量 + typecheck）
- [ ] **Step 5: Commit**：`feat(cram): §5.8 面试临时加密接线——常备用户约到面试一键冲刺`

### Task 7: D 常备模式文案 + needsDateUpdate 透出

**Files:** Modify `src/server/queue.ts`（DailyPayload 加 `mode`/`needsDateUpdate`）、`src/app/(drill)/DrillSession.tsx`（空态分叉）、`src/app/settings/SettingsForm.tsx`（就绪日说明）；Test `tests/app/drill-session.test.tsx`（追加）、`tests/app/settings-form.test.tsx`

- [ ] **Step 1: 失败测试**：
  1. DailyPayload 带 `mode: 'maintenance'` 且 needsDateUpdate → 首页空态显示「常备模式 · 今天没有到期卡」而非「今日队列是空的」引导；needsDateUpdate=true 时附「就绪日已过，已回到常备模式」
  2. SettingsForm 就绪日说明含「留空 = 常备模式」
- [ ] **Step 2: 确认失败** → **Step 3: 实现**（schedule 的 mode/needsDateUpdate 透传 DailyPayload；DrillSession 按 mode 分叉空态——注意保留现有 testid「progress」与既有空态文案分支）→ **Step 4: 验证**（全量 + typecheck + `next build`）
- [ ] **Step 5: Commit**：`feat(app): 常备模式文案——空态分叉 + 就绪日过期提示透出`

---

## Self-Review

- 覆盖：评审 R-1（Task 1）/R-2（Task 2）/A（Task 3）/B（Task 4）/R-3+spec（Task 5）/C（Task 6）/R-5+D（Task 7）✓
- 类型一致：`reviveDoneCards`/`applyCram`/`postCram` 命名在 Task 4/6 内一致；`maintenanceStep` 签名沿用 regenerate.ts ✓
- 无占位符；每步含验证与提交 ✓
