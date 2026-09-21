/**
 * 确定性随机源（§4.3 算法规格第 1 条）。
 *
 * 为什么不用 Math.random()：可单测、review_log.distractorIds 真能复现而不只是
 * 记录、服务端能校验客户端结果、同构一致性（§11）——四件事都要求
 * 「同 seed 必同序列」。sfc32 十几行，统计性质足够选项抽取用。
 */

export type Rng = () => number   // [0, 1)

/** FNV-1a 32 位。纯整数运算（Math.imul），Node 与浏览器逐字节一致 */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function sfc32(a: number, b: number, c: number, d: number): Rng {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0
    const t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    const out = (t + d) | 0
    c = (c + out) | 0
    return (out >>> 0) / 4294967296
  }
}

/** splitmix32：把单个种子摊开成 sfc32 需要的四个状态字 */
function splitmix32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x9e3779b9) | 0
    let t = Math.imul(s ^ (s >>> 16), 0x21f0aaad)
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97)
    return (t ^ (t >>> 15)) >>> 0
  }
}

export function seedRng(seed: number): Rng {
  const next = splitmix32(seed)
  return sfc32(next(), next(), next(), next())
}

/**
 * §4.3：seed = hash(userId, cardId, reviewIndex)。
 * 同一用户同一张卡第 N 次复习永远拿到同一套选项；N 变则选项变。
 * 用 NUL 字符作分隔符防拼接歧义：('u:2','c') 与 ('u','2:c')
 * 不会碰撞成同一字符串。
 */
export function hashSeed(userId: string, cardId: string, reviewIndex: number): number {
  return fnv1a(`${userId}\u0000${cardId}\u0000${reviewIndex}`)
}

/** Fisher-Yates 洗牌。返回新数组，不改输入（纯函数纪律，同 lib/scheduler） */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = a[i]!
    a[i] = a[j]!
    a[j] = tmp
  }
  return a
}
