---
id: 01M3M59WSEFB0XFJ0Q33TH1YTD
blockId: concurrency/thread-basics
relatedBlocks: []
question: 怎么正确中断一个线程？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么没有 stopThread 这种立即停止？
keyPoints:
  - id: kp-tb5-1
    text: 协作式中断：thread.interrupt() 打标记，不是强行掐断
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb5-2
    text: 被中断方自查：Thread.interrupted()（清除标记）或 isInterrupted()（保留）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb5-3
    text: sleep/join/wait/park 阻塞中收到中断会抛 InterruptedException 并清标记
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb5-4
    text: 捕获 InterruptedException 后的正确姿势：恢复标记或直接向上传播
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

Java **没有**「一拳打死线程」的开关（Thread.stop 已废弃——它直接解锁并杀死，对象可能被撕成两半）。中断是**递小纸条**：

1. `t.interrupt()`：给 t 贴一张「请停止」的**标记**——线程该怎么跑还怎么跑；
2. 线程在合适的时机**自查**纸条（`isInterrupted()`），自己决定怎么收尾；
3. 若线程正睡在 sleep/wait/join/park 里——立刻**惊醒并抛 InterruptedException**（标记同时被清掉）。

**捕获后的纪律**：要么继续往上抛，要么 `Thread.currentThread().interrupt()` **把标记贴回去**——否则上层再查中断就失聪了。吞掉不贴回 = 经典违规。

**术语速查**：interrupt=贴停止标记｜自查=线程主动查纸条｜惊醒抛错=阻塞中被中断的反应｜恢复标记=吞错前必须补票

<!--advanced-->
volatile boolean flag 与 interrupt 的差异：flag 无法唤醒阻塞中的线程、无 JDK 语义背书。stop 的死因：释放全部监视锁致不变式撕裂（half-updated 对象外泄）。Future.cancel(true) 内部即 interrupt；线程池 shutdownNow 对全部 worker 中断。响应策略在循环条件检查 isInterrupted 是标准形态。
