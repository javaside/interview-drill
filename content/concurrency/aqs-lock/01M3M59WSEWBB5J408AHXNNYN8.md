---
id: 01M3M59WSEWBB5J408AHXNNYN8
blockId: concurrency/aqs-lock
relatedBlocks: []
question: AQS（AbstractQueuedSynchronizer）的核心思想是什么？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么模板方法模式是它的精髓？
keyPoints:
  - id: kp-aq1-1
    text: 一个 volatile int state + 一条 CLH 变体的阻塞队列，构成同步器骨架
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-aq1-2
    text: state 语义由子类定义：ReentrantLock 记重入次数、Semaphore 记许可数、CountDownLatch 记计数
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-aq1-3
    text: 获取失败即入队 park；释放时唤醒后继节点
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-aq1-4
    text: ReentrantLock/Semaphore/CountDownLatch/线程池的 Worker 全是 AQS 的徒子徒孙
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

JUC 半数同步工具的**共同骨架**——AQS 只出两样东西：

1. **`volatile int state`**：一个数字，含义**由子类定义**——重入次数（ReentrantLock）、剩余许可（Semaphore）、倒数计数（CountDownLatch）、独占标志（线程池 Worker）；
2. **一条 FIFO 阻塞队列**（CLH 变体）：抢不到资源的线程打包成节点入队、`park` 挂起；释放资源时唤醒队头。

子类只需实现「**怎么算获取成功**（tryAcquire/tryAcquireShared）」和「**怎么算释放**（tryRelease）」——排队、挂起、唤醒、取消这些脏活 AQS 全包。这就是**模板方法**：流程骨架固定，业务语义留白。

**术语速查**：state=可自定义含义的同步数字｜CLH 队列=抢锁失败者的候客长龙｜模板方法=骨架父类定、步骤子类填

<!--advanced-->
Node 的 waitStatus（SIGNAL 谁该唤醒我）；入队 spin+CAS tail；head 哨兵虚节点。独占/共享两种模式（acquire/release 与 acquireShared/releaseShared——后者唤醒沿链传播）。Condition 的 await 即「释放+入条件队列」，signal 把节点迁回 CLH。state 的 CAS 是无锁快速路径，失败才 slow path 入队。
