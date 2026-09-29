import { pgTable, text, integer, timestamp, date, boolean, jsonb, uniqueIndex, index, primaryKey } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),                    // ULID，注册时铸造
  githubId: text('github_id').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** 用户设置——review_log 的 readyByDateAtReview/dailyCapacityAtReview 由此快照 */
export const userSettings = pgTable('user_settings', {
  userId: text('user_id').primaryKey().references(() => users.id),
  readyByDate: date('ready_by_date'),             // null = 未设 → 维持模式
  dailyCapacity: integer('daily_capacity').notNull().default(45),
  timezone: text('timezone').notNull().default('Asia/Shanghai'),
  plan: text('plan').notNull().default('free'),   // 'free' | 'paid'
  freeBlockIds: jsonb('free_block_ids').$type<string[]>().notNull().default([]),
  /** 当前岗位包（tracks.id）；null = 全部。纯导航偏好，不进 entitlement */
  trackId: text('track_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const blocks = pgTable('blocks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),           // 大类，干扰项池的分组键
})

/**
 * 岗位包（track）：块的有序引用集合，与 category 正交的导航视图。
 * 不外键到 blocks——内容源（content/tracks/*.yml）为准 upsert，
 * audit 在内容关保证引用存在；track 下线时 UI 对悬空 trackId 回退「全部」。
 */
export const tracks = pgTable('tracks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull(),
  blockIds: jsonb('block_ids').$type<string[]>().notNull().default([]),
})

export const cards = pgTable('cards', {
  id: text('id').primaryKey(),
  blockId: text('block_id').notNull().references(() => blocks.id),
  question: text('question').notNull(),
  cardType: text('card_type').notNull(),
  detail: text('detail').notNull(),
  followUps: jsonb('follow_ups').$type<string[]>().notNull().default([]),
  appliesTo: text('applies_to').notNull(),
  frequency: text('frequency').notNull(),
  conclusion: text('conclusion'),                 // 仅 judgment：'yes'|'no'|'depends'（Task 3）
  retiredAt: date('retired_at'),
})

export const keyPoints = pgTable('key_points', {
  id: text('id').notNull(),   // 复合主键 (cardId, id)——列级 primaryKey 与表级复合键冲突（PG 42P16），故此处仅 notNull
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  source: jsonb('source').$type<{ kind: string; url: string; locator: string }>().notNull(),
  public: boolean('public').notNull().default(false),
  order: integer('order'),
  excludeAsDistractorFor: jsonb('exclude_as_distractor_for').$type<string[]>().notNull().default([]),
  retiredAt: date('retired_at'),
}, t => [primaryKey({ columns: [t.cardId, t.id] })])

/**
 * plan 存绝对日期数组（§8.1 + 计划 2 尾注）；s 存分子分母（精确有理数）。
 * (userId, cardId) 主键。
 */
export const cardState = pgTable('card_state', {
  userId: text('user_id').notNull(),
  cardId: text('card_id').notNull(),
  phase: text('phase').notNull().default('new'),
  sNum: integer('s_num').notNull().default(0),
  sDen: integer('s_den').notNull().default(1),
  plan: jsonb('plan').$type<string[]>().notNull().default([]),   // 'YYYY-MM-DD' 绝对日期，升序
  phaseIndex: integer('phase_index').notNull().default(0),
  reviewCount: integer('review_count').notNull().default(0),
  planGeneratedAt: timestamp('plan_generated_at', { withTimezone: true }),
  algoVersion: text('algo_version').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.userId, t.cardId] }),
  index('card_state_user_idx').on(t.userId),
])

/** append-only，永不更新（§8.1）。submissionId 唯一索引 = 幂等键。 */
export const reviewLog = pgTable('review_log', {
  id: text('id').primaryKey(),                    // ULID
  submissionId: text('submission_id').notNull(),
  userId: text('user_id').notNull(),
  cardId: text('card_id').notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull(),  // UTC 瞬时，仅排序
  localDate: date('local_date').notNull(),        // 服务端判定（§8.3）
  correctChecked: integer('correct_checked').notNull(),
  wrongChecked: integer('wrong_checked').notNull(),
  keyPointsTotal: integer('key_points_total').notNull(),
  readyByDateAtReview: date('ready_by_date_at_review'),
  dailyCapacityAtReview: integer('daily_capacity_at_review').notNull(),
  distractorIds: jsonb('distractor_ids').$type<string[]>().notNull().default([]),
  clockClamped: text('clock_clamped'),            // null | 'past' | 'future'
  algoVersion: text('algo_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('review_log_submission_uidx').on(t.submissionId),
  index('review_log_user_card_idx').on(t.userId, t.cardId),
])

/** 今日进度分母：per-(用户, 本地日)，当天首次取队列时写定（§6/§8.1） */
export const dailySession = pgTable('daily_session', {
  userId: text('user_id').notNull(),
  localDate: date('local_date').notNull(),
  queueSize: integer('queue_size').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.localDate] })])

/**
 * 付费订单（§10 付费解锁 · 计划 5）。下单即 pending；支付回调履约时置 paid 并写网关流水号。
 * status 取值对齐 lib/billing 的 OrderStatus：'pending'|'paid'|'failed'|'expired'。
 */
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
