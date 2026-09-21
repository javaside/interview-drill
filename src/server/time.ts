import { TZDate } from '@date-fns/tz'
import type { LocalDate } from '../lib/scheduler/date.js'

/**
 * §8.3：localDate 只由服务端判定；锁定版本的 tz 库（@date-fns/tz），禁 Intl。
 *
 * 非法时区的检测信号（经 @date-fns/tz@1.5.0 实测）：
 *   `new TZDate(ms, tz)` 对非法 IANA 名（如 'Mars/Olympus'）**不会**在构造期抛错，
 *   但首个字段 getter（getFullYear/getMonth/getDate）会抛 RangeError
 *   （"Invalid time zone specified: …"），且此时 getTimezoneOffset() 返回 NaN。
 *   我们据此判定非法：try/catch 捕获 getter 抛出的 RangeError，并对返回值做 NaN
 *   兜底（双保险）——两者皆不直接调用 Intl/DateTimeFormat，符合本任务禁 Intl 的口径
 *   （TZDate 内部经 ICU 取偏移是已知诚实边界，见计划 §全局约束「时区口径的诚实边界」）。
 */
export function localDateOf(instantMs: number, ianaTz: string): LocalDate {
  try {
    const d = new TZDate(instantMs, ianaTz)
    const y = d.getFullYear()
    const mo = d.getMonth()
    const day = d.getDate()
    if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(day)) {
      throw new Error('NaN date fields')
    }
    const p = (n: number) => String(n).padStart(2, '0')
    return `${y}-${p(mo + 1)}-${p(day)}`
  } catch {
    throw new Error(`非法 IANA 时区：${ianaTz}`)
  }
}

export const MAX_CLOCK_SKEW_MS = 5 * 60_000

/**
 * 异常时钟钳制（§8.3）：早于该卡上一条 → last+1ms（保持严格升序，排序稳定）；
 * 晚于服务端 now+容差 → now。被钳制的返回标记，落 review_log.clockClamped。
 */
export function clampReviewedAt(
  candidateMs: number,
  lastMs: number | null,
  serverNowMs: number,
): { ms: number; clamped: null | 'past' | 'future' } {
  if (lastMs !== null && candidateMs <= lastMs) {
    return { ms: lastMs + 1, clamped: 'past' }
  }
  if (candidateMs > serverNowMs + MAX_CLOCK_SKEW_MS) {
    return { ms: serverNowMs, clamped: 'future' }
  }
  return { ms: candidateMs, clamped: null }
}
