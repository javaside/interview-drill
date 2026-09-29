/** 要点长度上界（汉字数）。KP2「单一信息核」的廉价代理，不替代人工判断 */
export const MAX_KP_HAN_CHARS = 30

/** KP5 承载词：把多个事实折叠进一个词，是"把不可枚举硬塞进枚举"的语法标志 */
const CARRIER_WORDS = ['等', '多种', '一系列', '若干', '之类', '诸如', '各种'] as const

/** 块名黑名单（§9.3 第 3 条机器规则）：这些词说明块的边界没想清楚 */
const VAGUE_BLOCK_WORDS = ['基础', '进阶', '高级', '其他', '常见问题', '高频'] as const

const HAN = /\p{Script=Han}/gu

export function countHanChars(s: string): number {
  return (s.match(HAN) ?? []).length
}

/**
 * 脚手架占位符。必须有这条检查，否则"全部通过 schema 校验"这个完成标准
 * 可以被 1345 张**没写过内容的空骨架**满足 —— 脚手架产出的
 * `待填写要点 1` / `REPLACE-ME` 是完全合法的字符串，schema 拦不住。
 */
const PLACEHOLDERS = ['待填写', 'REPLACE-ME', 'example.org'] as const

export function checkPlaceholders(text: string): string[] {
  return PLACEHOLDERS.filter(ph => text.includes(ph)).map(
    ph => `仍含脚手架占位符「${ph}」，这张卡还没写完`,
  )
}

export function checkKeyPointText(text: string): string[] {
  const issues: string[] = []
  const n = countHanChars(text)
  if (n > MAX_KP_HAN_CHARS) {
    issues.push(`要点过长：${n} 个汉字，上界 ${MAX_KP_HAN_CHARS}（违反 KP2 单一信息核）`)
  }
  for (const w of CARRIER_WORDS) {
    if (text.includes(w)) {
      issues.push(`要点含承载词「${w}」，它折叠了未知数量的事实（违反 KP5）`)
    }
  }
  return issues
}

export function checkBlockName(name: string): string[] {
  const issues: string[] = []
  for (const w of VAGUE_BLOCK_WORDS) {
    if (name.includes(w)) {
      issues.push(`块名含模糊词「${w}」，说明块的边界没定清楚（§9.3 第 3 条机器规则）`)
    }
  }
  return issues
}

/** sequence 要点文本中的顺序标号——数字与圈数字都算（圈序号/步骤N 是同义变体） */
const SEQ_ORDER_MARKERS = [
  /第\s*[\d一二三四五六七八九十]+\s*步/,
  /步骤\s*[\d一二三四五六七八九十]+/,
  /[①②③④⑤⑥⑦⑧⑨⑩]/,
] as const

/**
 * sequence 专属文案规则：要点不得自带顺序标号。排序题的答案就是顺序，
 * 标号（「第 1 步」「①」）把答案写在题面上——呈现序再怎么洗牌，用户按
 * 数字排就能满分，排序交互退化为数数。顺序只应蕴含在 order 字段与内容
 * 逻辑里。仅 sequence 卡调用：enumeration 讲步骤带叙述性序词不泄题。
 */
export function checkSequenceKeyPointText(text: string): string[] {
  for (const marker of SEQ_ORDER_MARKERS) {
    if (marker.test(text)) {
      return ['要点文本自带顺序标号——排序题的答案被写在题面上（顺序只应蕴含在 order 与内容逻辑里）']
    }
  }
  return []
}
