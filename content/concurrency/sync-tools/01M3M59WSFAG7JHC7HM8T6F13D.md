---
id: 01M3M59WSFAG7JHC7HM8T6F13D
blockId: concurrency/sync-tools
relatedBlocks:
  - concurrency/aqs-lock
question: "CountDownLatch 和 CyclicBarrier 的区别？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 多轮迭代计算为什么选 Barrier？
keyPoints:
  - id: kp-st1-1
    text: "Latch：主线程候 N 个干活的完成——计数递减到零放行（一次性）"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'juc'
  - id: kp-st1-2
    text: "Barrier：N 个线程互候、到齐一起过闸（可复用 reset）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'juc'
  - id: kp-st1-3
    text: "Latch 的事件是「别人做完事」；Barrier 的事件是「大家到齐」"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'juc'
  - id: kp-st1-4
    text: "await 阻塞候行；countDown 或到达不打断已通过者"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'juc'
---

两个「凑齐再走」的工具，**主语不同**：

- **CountDownLatch（门闩）**：**一个人候一群人**——主线程 await() 候着，每个干活的完成时 countDown() 扣一格，**归零开门**。一次性用品（门开了就废）。
- **CyclicBarrier（栅栏）**：**一群人互候**——N 个线程各自 await() 到栅栏前，**最后一个到的踩响发令枪**，全体同时放行。**可复用**——迭代计算每轮汇合一次，天然匹配。

**术语速查**：门闩=候归零放行｜栅栏=互候齐跑｜一次性 vs 循环

<!--advanced-->
latch 基于 AQS 共享（state=count，acquireShared 即 state==0）；barrier 基于可重入锁+Condition（generation 代际，broken 撕票唤醒全员 BrokenBarrierException）。barrier 的回调在放行前由最后到达者执行。Phaser 是两者超集（动态注册方/分层）。
