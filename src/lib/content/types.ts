/** 题型。决定出题形式与计分方式，见设计文档 §4.3 */
export type CardType =
  | 'enumeration'  // 可枚举型：答案是无序清单
  | 'comparison'   // 对比推理型：X vs Y，正确要点须成对
  | 'sequence'     // 因果链/过程型：顺序即答案，排序题，选项不打乱
  | 'judgment'     // 权衡判断型：二段式，先结论后支撑
  | 'atomic'       // 单点事实型：单选 4 选 1

export type Frequency = 'high' | 'mid' | 'low'

/**
 * 要点出处。必须指向英文一手资料——设计文档 §9.1 规定中文技术博客
 * 不得作为 source，因为中文圈流传的错误结论正是双模型交叉预审失效的根源。
 * `kind` 的枚举本身就是这条规则的执行机制。
 */
export type SourceKind = 'official-doc' | 'source-code' | 'rfc' | 'jsr' | 'spec'

export type Source = {
  kind: SourceKind
  /** 资料 URL */
  url: string
  /** 精确定位：类#方法、章节号、RFC 小节。如 'AbstractQueuedSynchronizer#acquire' */
  locator: string
}

export type KeyPoint = {
  /** 块内唯一。互斥登记、漏点统计、干扰项引用都指向它 */
  id: string
  text: string
  source: Source
  /** 该条要点自己的版本范围，缺省继承卡级 appliesTo */
  appliesTo?: string
  /** 本要点对这些题（cardId）也成立，不得抽作它们的干扰项 */
  excludeAsDistractorFor: string[]
  /**
   * 人工已确认"对这些题不成立"。仅用于避免重复确认，不参与出题。
   * 没有这个字段的话，答"否"的组合不留痕，每次重跑互斥 CLI 都会原样再问一遍 ——
   * 而重跑是常态（加了新题、调了阈值、中途退出）。工具会反复消耗它本该保护的那 25-60 小时。
   */
  confirmedIndependentOf: string[]
  /** 审核签字日期 YYYY-MM-DD，驱动 §9.2 的增量复核 */
  verifiedAt: string
  /** 公开要点：用于 SEO lead-in，且构成免费用户的跨块干扰项池 */
  public: boolean
  /** 仅 cardType='sequence' 必填：该步骤在流程中的序号，从 1 起 */
  order?: number
  /**
   * 推理链。当本要点是**从已引用事实推出的结论**、而非可直接引用的事实时必填。
   *
   * 为什么需要它：§4.3 实测 comparison(15.3%) + judgment(11.5%) 共约 27% 的题，
   * 答案是推理出来的 ——「为什么 InnoDB 不用跳表」在 MySQL 手册里没有这一段。
   * 而 §9.1 要求"无出处的断言一律剔除"。按字面执行，这 27% 一条都写不出来，
   * 作者只能改写枚举题，正好是 §4.3 记录的那三条漂移力之一。
   *
   * 这个字段不是放宽规则，是把推理变成**可审查的对象**：`source` 仍然必须指向
   * 推理所依据的那些事实，`reasoning` 写清从事实到结论这一步怎么走。
   * 审核者可以分别检查"事实对不对"和"这一步推得通不通"。
   */
  reasoning?: string
  /** 本要点由哪个旧 id 改名而来，供跨提交守卫放行 */
  movedFrom?: string
  /** 退役日期。复审判定写错要删掉时用它，而不是真删 —— review_log.distractorIds 引用着它 */
  retiredAt?: string
}

export type Card = {
  id: string
  blockId: string
  relatedBlocks: string[]
  question: string
  cardType: CardType
  keyPoints: KeyPoint[]
  /** markdown 正文，展开讲解，不参与计分 */
  detail: string
  followUps: string[]
  /** 卡级版本适用范围，如 'JDK 8+' */
  appliesTo: string
  frequency: Frequency
  /** tombstone：退役日期 YYYY-MM-DD。设置后不再出题，但保留以免 review_log 悬空 */
  retiredAt?: string
  /** id 迁移记录：本卡由哪个旧 id 改名而来，供 CI 跨提交守卫放行 */
  movedFrom?: string
}
