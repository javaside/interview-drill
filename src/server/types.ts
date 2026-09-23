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
  conclusion?: 'yes' | 'no' | 'depends'
}

export type Settings = { readyByDate: LocalDate | null; dailyCapacity: number }
