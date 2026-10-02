ALTER TABLE "orders" ADD COLUMN "pass_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "paid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "grace_until" date;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "grace_block_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- 手工追加（drizzle-kit autogenerate 不会生成）：存量付费用户统一转 30 天通行证。
-- 2026-10-02 用户拍板：不 grandfather，原永久解锁的账号（含内测与本人）一律从本迁移
-- 执行时刻起算 30 天。
--
-- 顺序敏感：**先 backfill 再切代码**。新代码只认 paid_until，若只切代码不跑这步，
-- 所有存量付费用户立刻掉权限。反向是安全的（列留着无害、旧代码读 plan 仍见 'paid'）。
UPDATE "user_settings" SET "paid_until" = now() + interval '30 days' WHERE "plan" = 'paid';
