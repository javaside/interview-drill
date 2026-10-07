---
id: 01M3M59WSE8XM59X0SGY7EPQSN
blockId: concurrency/volatile-jmm
relatedBlocks: []
question: 什么是指令重排？为什么需要它？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - as-if-serial 在多线程为什么失效？
keyPoints:
  - id: kp-vj2-1
    text: 编译器/JIT、CPU、缓存层都会调整指令顺序以提升流水线效率
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSE515VZJT4KBTVTFX0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj2-2
    text: 单线程语义不变是底线（as-if-serial）：结果与顺序执行一致
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj2-3
    text: 多线程下重排会撕开「先行后写」的直觉依赖
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSE515VZJT4KBTVTFX0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj2-4
    text: 经典受害：双重检查锁定的半成品对象（构造指令与引用赋值重排）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSE515VZJT4KBTVTFX0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

为了跑得快，**编译器和 CPU 都会偷偷调换指令顺序**（等流水线不断流、缓存命中率拉满）。底线只有一条：**单线程看不出来**（as-if-serial——算出来结果跟顺序执行一样）。

但多线程把这条底线撕了：线程 A 里「先初始化字段、再发布引用」的两步被重排成「先发引用、字段还没写完」——线程 B 拿着引用读到**半成品**。双重检查锁定（DCL）不加 volatile 的著名 bug 就是它。

**术语速查**：重排=调指令序不调结果｜as-if-serial=单线程无感｜半成品对象=构造未完引用先出

<!--advanced-->
源级→编译器优化→指令级并行（ILP 乱序执行）→内存系统（store buffer/失效队列）四层重排来源。数据依赖性是硬约束；控制/反依赖可被窥探优化打破。happens-before 是 JMM 给程序员的契约模型：符合 HB 的写对读可见且有序，否则一切重排许可。
