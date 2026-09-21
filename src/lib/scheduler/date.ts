/**
 * 本地日历日，YYYY-MM-DD。§5.1：日差按日历天计算。
 *
 * 为什么全程走 UTC 午夜：字符串拆分 + Date.UTC 构造根本不经过任何本地时区，
 * DST 切换那天（23 或 25 小时）也是精确的整数天。早期设计的
 * `ms / 86400000` 在 DST 日会得到 0.96 / 1.04，取整少一天——spec 明令禁止。
 */
export type LocalDate = string

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function toUtc(d: string): Date {
  if (!DATE_RE.test(d)) throw new Error(`非法日期格式：${d}（应为 YYYY-MM-DD）`)
  const [ys, ms, ds] = d.split('-')
  const y = Number(ys), m = Number(ms), day = Number(ds)
  const t = new Date(Date.UTC(y, m - 1, day))
  // 回读校验：2026-02-30 会被 Date.UTC 滚动成 3 月 2 日，必须当非法输入拒掉
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== day) {
    throw new Error(`不存在的日历日：${d}`)
  }
  return t
}

function fromUtc(ms: number): LocalDate {
  const t = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`
}

/** a − b 的日历天数。a 晚于 b 为正。 */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtc(a).getTime() - toUtc(b).getTime()) / 86_400_000)
}

/** d 加 n 天（可为负）。 */
export function addDays(d: LocalDate, n: number): LocalDate {
  return fromUtc(toUtc(d).getTime() + n * 86_400_000)
}
