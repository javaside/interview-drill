/**
 * 排期算法语义版本（spec §8.2：语义变更时 bump，card_state.algo_version 落库留痕）。
 * v2（2026-09-28，计划 6 常备模式）：计划耗尽自动落维持滚动，废除自动 done；
 * 常备模式设置变更不清空滚动计划；新卡首曝按 newPerDayOf 限流。
 */
export const ALGO_VERSION = 'v2'
