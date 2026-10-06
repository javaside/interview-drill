---
id: 01M3M59WSC7G93TJ7FEFYCPS57
blockId: concurrency/thread-basics
relatedBlocks: []
question: 创建线程有哪几种方式？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么推荐 Runnable 而非继承 Thread？
keyPoints:
  - id: kp-tb1-1
    text: 继承 Thread 重写 run
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb1-2
    text: 实现 Runnable 传给 Thread（任务与执行器解耦，推荐）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb1-3
    text: 实现 Callable + FutureTask：有返回值、可抛受检异常
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb1-4
    text: 线程池 submit/executors 提交 Runnable 或 Callable（生产标准）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb1-5
    text: 本质只有 new Thread().start() 一种启动方式，其余都是任务的形态
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

四种「姿势」，但**本质只有一个入口**：`new Thread(任务).start()`。区别只是「任务」长什么样：

1. **继承 Thread**：把「怎么跑」焊死在「线程本身」上——类被占用、任务无法复用、没法进线程池；
2. **实现 Runnable**（推荐）：任务是任务、线程是线程——同一个任务可以给线程跑、给池跑、跑多次；
3. **Callable + FutureTask**：任务要**返回值**/要抛受检异常时用，结果从 `Future.get()` 领取；
4. **线程池提交**：生产代码的唯一起点——不 new Thread，让池管生命周期。

**术语速查**：Runnable=无返回的任务｜Callable=有返回可抛错的清单｜Future=领取结果的凭据

<!--advanced-->
Thread 实现 Runnable 本身（is-a + has-a 双通道）；start 的语义是向 JVM 注册新执行流并回调 run，直接调 run 只是普通方法调用（同线程）。虚拟线程（19+ 预览/21 正式）以 Thread.ofVirtual() 开启轻量级形态，Runnable/Callable 不变。
