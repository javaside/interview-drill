---
id: 01M3M59WSFG8V1FNZT0TC921EE
blockId: concurrency/sync-tools
relatedBlocks: []
question: Future 和 CompletableFuture 的区别？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - thenApply 和 thenCompose 的区别？
keyPoints:
  - id: kp-st5-1
    text: Future：提交后领凭据——get 阻塞领结果，不能组合、不能回调
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-st5-2
    text: CompletableFuture：回调式异步——thenApply 与 thenCompose 链式组合
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-st5-3
    text: 异常传播：exceptionally 与 handle 统一接住链上任意环节的错
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-st5-4
    text: 默认跑 ForkJoinPool.commonPool，生产应 supplyAsync 传自家线程池
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
---

**Future** 是「取件条」：future.get() ——**傻站到货**；想「到货后再加工」只能自己再 get 再写，无法声明**流水线**。

**CompletableFuture** 是「流水线工单」：

    supplyAsync(() -> 查用户)          // 异步开工
      .thenApply(u -> u.getOrderId())   // 到货加工（同步映射）
      .thenCompose(id -> 查订单(id))    // 到货再派新异步（扁平化）
      .exceptionally(e -> 兜底值)       // 全链任意环出错接住
      .thenAccept(System.out::println); // 消费

thenApply = 映射一步；thenCompose = 映射后**接另一条异步**（返回 CompletableFuture 时防套娃，同 flatMap）。

**坑**：默认 commonPool 全 JVM 共享——生产代码**显式传线程池**。

**术语速查**：回调=到货自动触发下一步｜组合=流水线声明｜exceptionally=全链兜底｜显式传池=别蹭公共池

<!--advanced-->
thenApplyAsync 与 thenApply 的执行线程语义（谁完成谁跑 vs 池化）。allOf/anyOf 的聚合（任一异常即异常完成）。orTimeout/completeOnTimeout（9+）。与 Reactor 的心智承接（单值 vs 流）。
