import type { LocalDate } from '../lib/scheduler/date.js'

export type ConclusionChoice = 0 | 1 | 2   // 0=yes 1=no 2=depends，与 UI 三选对齐

export type Submission = { submissionId: string; cardId: string; reviewedAtMs: number } & (
  | { kind: 'selection'; selected: number[] }
  | { kind: 'sequence'; order: number[] }
  | { kind: 'judgment'; conclusion: ConclusionChoice; selected: number[] }
  | { kind: 'atomic'; selected: number }
)

/** 判分与装配所需的最小卡快照（DB cards/key_points 行的投影） */
export type CardSnapshot = {
  cardId: string
  blockId: string
  /** 块显示名（blocks.name）——UI 屏①/屏② 展示用，装配/判分不依赖，故可选 */
  blockName?: string
  /** 题面（cards.question）——UI 屏①/屏② 展示用，可选 */
  question?: string
  cardType: 'enumeration' | 'comparison' | 'sequence' | 'judgment' | 'atomic'
  frequency: 'high' | 'mid' | 'low'
  keyPoints: Array<{
    id: string; text: string; public: boolean
    excludeAsDistractorFor: string[]   // OptionKeyPoint 必填字段，池装配直接消费
    retiredAt?: string; order?: number
  }>
  /**
   * 专属错误选项（misconceptions 表投影，spec §2.3）。判分重算（replay.variantAt）与
   * 展示装配（queue 两投影）共用同一快照——缺了它重算的池缺口不同、rng 序列不同，
   * 判的就是另一份卷（判分与展示同卷铁律）。可选 = 无 mc 的存量卡不携带该字段。
   */
  misconceptions?: Array<{ id: string; text: string; why: string; retiredAt?: string }>
  conclusion?: 'yes' | 'no' | 'depends'
  /** 题解讲解（cards.detail）——UI 屏①「先看讲解」用，装配/判分不依赖，故可选 */
  detail?: string
}

export type Settings = { readyByDate: LocalDate | null; dailyCapacity: number }
