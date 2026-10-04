/**
 * 干扰项分层的**权威口径**：同块 / 同大类跨块 / 相邻大类。
 *
 * 为什么单独成文件而不是留在 server/queue.ts：内容侧工具（exclusion 的三层枚举、
 * 池余量报告）必须与运行时**逐字同规则**。此前两侧各写一份，且都依赖各自数据源的
 * 行序 —— runtime 走 `select id, category from blocks`（无 ORDER BY，行序 = 插入序，
 * PG 不作保证），工具走 readdirSync（无序）。实测方向写反会换掉整个相邻层
 * （54,109 组 / 49.7%），而总数只差 0.26%（108,891 vs 108,606）—— 只看总数发现不了，
 * 闸门会全绿而线上的假阴性原样存在。
 *
 * 规则：**大类值序列按大类名升序**（不是插入序，也不是文件序）。升序是任意的，
 * 但必须是**确定且两侧同源**的 —— 这同时修掉出题侧的确定性缺陷（相邻层兜底时，
 * 不同实例若行序不同，同一次复习会抽到不同干扰项，破坏「判分与展示同卷」）。
 */

/** 大类值序列：去重 + 按名称升序。输入行序不影响结果 */
export function categorySequenceOf(categories: ReadonlyMap<string, string>): string[] {
  return [...new Set(categories.values())].sort()
}

/**
 * 序列里 current 的下一项（循环）——neighbor 层的相邻大类。
 * 少于两个大类、或 current 不在序列中 → undefined（neighbor 层空）。
 */
export function neighborCategoryOf(
  categories: ReadonlyMap<string, string>,
  current: string,
): string | undefined {
  const seq = categorySequenceOf(categories)
  if (seq.length < 2) return undefined
  const i = seq.indexOf(current)
  if (i < 0) return undefined
  return seq[(i + 1) % seq.length]
}

export type DistractorLayer = 'sameBlock' | 'crossBlock' | 'neighbor'

/**
 * 某张**别的卡**属于目标卡的哪一层。null = 进不了任何池（大类未知、或既不同类也不相邻）。
 * 目标卡自己的块返回 'sameBlock'（调用方在装配时已由 sameBlockPoolOf 覆盖，不重复收）。
 */
export function layerOf(
  targetBlockId: string,
  ownerBlockId: string,
  categories: ReadonlyMap<string, string>,
): DistractorLayer | null {
  if (ownerBlockId === targetBlockId) return 'sameBlock'
  const targetCategory = categories.get(targetBlockId)
  const ownerCategory = categories.get(ownerBlockId)
  if (targetCategory === undefined || ownerCategory === undefined) return null
  if (ownerCategory === targetCategory) return 'crossBlock'
  return neighborCategoryOf(categories, targetCategory) === ownerCategory ? 'neighbor' : null
}
