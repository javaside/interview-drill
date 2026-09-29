import { blockMastery } from '../lib/mastery/block.js'
import type { BlockMastery, BlockEntry } from '../lib/mastery/block.js'
import type { Frequency } from '../lib/mastery/types.js'
import { entitledBlockIds } from '../lib/entitlement/entitlement.js'
import type { Entitlement } from '../lib/entitlement/entitlement.js'
import type { CardState } from '../lib/scheduler/types.js'

/**
 * 知识地图一格（§4.4 + §10.1）：块名、大类、真实题数、解锁位、块级掌握度。
 * unlocked=false 的块只暴露 cardCount（真实题量），是产品内唯一付费转化入口。
 */
export type BlockMapEntry = {
  blockId: string
  blockName: string
  category: string
  cardCount: number
  unlocked: boolean
  mastery: BlockMastery
}

/**
 * buildBlockMap 的只读 IO 依赖（mapDepsOf 注入真实 adapters；测试可注简桩）。
 * - loadBlocks：全块 + 未退役卡计数（题量）。
 * - loadStates：该用户全部卡状态（phase/s，喂 blockMastery 的判定与得分）。
 * - loadEnt：解锁边界（决定每块 unlocked）。
 * - loadCardBlocks：每卡 → 其所属块与频次（分组键 + 掌握度权重）；phase/s 从 states 取。
 */
export type BlockMapDeps = {
  userId: string
  loadBlocks(): Promise<Array<{ blockId: string; blockName: string; category: string; cardCount: number }>>
  loadStates(): Promise<CardState[]>
  loadEnt(): Promise<Entitlement>
  loadCardBlocks(): Promise<Map<string, { blockId: string; frequency: Frequency }>>
}

/**
 * 块级掌握度聚合（纯核，§4.4）：按块把有状态的卡组成 BlockEntry 喂 blockMastery，
 * 无状态卡不进 entries → 空块由 blockMastery 判为 untried（不是 0%）。
 * unlocked 由 entitledBlockIds 判定（免费=已选块，付费=全部）。
 */
export async function buildBlockMap(deps: BlockMapDeps): Promise<BlockMapEntry[]> {
  const [blocks, states, ent, cardBlocks] = await Promise.all([
    deps.loadBlocks(),
    deps.loadStates(),
    deps.loadEnt(),
    deps.loadCardBlocks(),
  ])
  const allIds = blocks.map(b => b.blockId)
  const unlocked = new Set(entitledBlockIds(ent, allIds))

  // 按 blockId 归并该块内有状态卡的 { frequency, phase, s }
  const entriesByBlock = new Map<string, BlockEntry[]>()
  for (const st of states) {
    const cb = cardBlocks.get(st.cardId)
    if (cb === undefined) continue   // 卡已退役 / 不在全库视图，跳过
    const arr = entriesByBlock.get(cb.blockId) ?? []
    arr.push({ frequency: cb.frequency, phase: st.phase, s: st.s })
    entriesByBlock.set(cb.blockId, arr)
  }

  return blocks.map(b => ({
    blockId: b.blockId,
    blockName: b.blockName,
    category: b.category,
    cardCount: b.cardCount,
    unlocked: unlocked.has(b.blockId),
    mastery: blockMastery(entriesByBlock.get(b.blockId) ?? []),
  }))
}

/**
 * 按岗位包过滤地图（纯核）：只保留 track 引用的块，**组内按 track 的建议顺序**排列
 * （category 分组由视图层做，这里只过滤+排序）。track 不在列表中（未知 id/悬空）→
 * 视为「全部」，原样返回——岗位是导航视图，宁可全显也不空白。
 */
export function filterEntriesByTrack(
  entries: BlockMapEntry[], tracks: Array<{ id: string; blockIds: string[] }>, trackId: string | null,
): BlockMapEntry[] {
  if (trackId === null) return entries
  const track = tracks.find(t => t.id === trackId)
  if (track === undefined) return entries
  const order = new Map(track.blockIds.map((id, i) => [id, i] as const))
  const inTrack = entries.filter(e => order.has(e.blockId))
  return inTrack.sort((a, b) => (order.get(a.blockId)! - order.get(b.blockId)!))
}
