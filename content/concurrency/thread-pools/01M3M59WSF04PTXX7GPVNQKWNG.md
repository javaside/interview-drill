---
id: 01M3M59WSF04PTXX7GPVNQKWNG
blockId: concurrency/thread-pools
relatedBlocks: []
question: 四种拒绝策略是什么？怎么选？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么说 CallerRuns 是天然限流？
keyPoints:
  - id: kp-tp3-1
    text: AbortPolicy（默认）：抛 RejectedExecutionException——快速失败
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tp3-2
    text: CallerRunsPolicy：让提交任务的线程自己跑——天然限流反压
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tp3-3
    text: DiscardPolicy：静默丢弃（最危险：无声无息）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tp3-4
    text: DiscardOldestPolicy：丢队头最老的，给新任务腾位
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

池满之后的**四种处置**：

- **Abort**（默认）：直接抛异常——让调用方**立刻知道**扛不住了（可观测可兜底）；
- **CallerRuns**：**谁提交谁自己跑**——提交线程被拖住干活，自然放慢提交速度（**反压/天然限流**，下游不炸上游先慢）；
- **Discard**：**无声丢弃**——任务消失没人知道（除非你无所谓这个任务，否则别用）；
- **DiscardOldest**：扔掉**队头**（排最久的），塞新的进队——保新鲜弃陈旧。

选型直觉：要**可感知**（Abort+上层重试/告警）；要**削峰不丢**（CallerRuns）；确实可丢才 Discard 系。互联网常见的第五种：**自定义 handler**——落库/发 MQ 削峰，恢复后再回放。

**术语速查**：反压=上游被拖慢自救｜快速失败=炸出来比烂掉好｜自定义=落盘回放的缓冲带

<!--advanced-->
拒绝时机：addWorker 失败（wc≥max）或 offer 失败即触发 handler.rejectedExecution。CallerRuns 的副作用：提交线程占住执行权期间池可能已腾空（非精确限流）。钩子 beforeExecute/afterExecute 可埋监控。动态调参（setCorePoolSize）配合有界队列是弹性手段（美团方案原型）。
