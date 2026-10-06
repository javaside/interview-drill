---
id: 01M3M59WSEQKQYZN64JNA2A5CZ
blockId: concurrency/thread-pools
relatedBlocks: []
question: 线程池的核心参数有哪些？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么必须给线程命名？
keyPoints:
  - id: kp-tp1-1
    text: corePoolSize 常驻线程数；maximumPoolSize 峰值上限
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tp1-2
    text: workQueue 任务队列：无界/有界/同步移交（SynchronousQueue）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tp1-3
    text: keepAliveTime：超过 core 的空闲线程的存活时限
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tp1-4
    text: threadFactory 线程工厂（命名——排查的救命稻草）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tp1-5
    text: rejectedExecutionHandler 拒绝策略：队列满且线程到顶之后怎么办
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

`ThreadPoolExecutor` 的**七大件**（把下面按语义排）：

1. **corePoolSize**：常驻编制——来任务先养到这个数；
2. **workQueue**：编制满了，任务**排队**（有界队列是纪律，无界队列是内存炸弹）；
3. **maximumPoolSize**：队列也满了 → 临时扩编到这个顶；
4. **keepAliveTime**：临时工的合同期——闲过了就裁回 core；
5. **threadFactory**：产线程的工厂——**给线程起名**（thread-dump 里无名线程全是谜语人，命名是排查底线）；
6. **rejectedExecutionHandler**：编制到顶、队列到满 → 新任务的出路（见下一张卡）。

**术语速查**：core=常驻编制｜队列=排班表｜max=临时扩编上限｜拒绝策略=全满后的处置

<!--advanced-->
execute 的判定序（ctl 的 AtomicInteger 拆 workerCount/runState）：wc<core 直接 addWorker；offer 队列失败且 wc<max 再 addWorker；都满触发 handler。prestartAllCoreThreads 可预热。allowCoreThreadTimeOut 让常驻也可回收（配 keepAlive）。
