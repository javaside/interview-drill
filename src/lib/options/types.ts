/**
 * lib/options 的最小输入类型。结构上是 lib/content Card/KeyPoint 的子集——
 * 零依赖纪律（同 lib/scheduler 的 SchedulableCard 先例）：内容侧字段再多，
 * 出题只认这里列出的。
 */
export type CardType = 'enumeration' | 'comparison' | 'sequence' | 'judgment' | 'atomic'

/** 结构兼容 lib/scheduler 的 Rational：整数分子/分母，den > 0 */
export type Rational = { num: number; den: number }

export type OptionKeyPoint = {
  id: string
  text: string
  /** SEO lead-in 与免费用户跨块池的成员资格（§4.3） */
  public: boolean
  /** 本要点对这些题也成立，不得抽作它们的干扰项 */
  excludeAsDistractorFor: string[]
  /** 退役要点不再进入选项（§7 tombstone：保留 id 供 review_log 引用） */
  retiredAt?: string
  /** 仅 sequence 型：步骤序号，从 1 起——顺序就是这型题的答案 */
  order?: number
}

export type OptionCard = {
  id: string
  blockId: string
  cardType: CardType
  keyPoints: OptionKeyPoint[]
}

/**
 * 三层干扰项池（§4.3）。跨块层装什么由 lib/entitlement 决定（免费 = 公开
 * 要点池，付费 = 整个大类），装配发生在 server（计划 4），本库只消费。
 */
export type DistractorPools = {
  /** 同块其他题的要点 */
  sameBlock: OptionKeyPoint[]
  /** 同大类其他块的要点（免费用户这里只装 public 池） */
  crossBlock: OptionKeyPoint[]
  /** 相邻大类的要点：两层枯竭时兜底，触发 degradedTo='neighbor' */
  neighbor: OptionKeyPoint[]
}

/** §4.3 出题规则：多选选项总数固定 9——选项个数不携带"几条是对的"信息 */
export const OPTIONS_TOTAL = 9

/** §4.3 分型表：atomic 单选 4 选 1 */
export const ATOMIC_OPTIONS_TOTAL = 4
