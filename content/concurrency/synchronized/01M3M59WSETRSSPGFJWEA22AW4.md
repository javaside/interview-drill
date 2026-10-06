---
id: 01M3M59WSETRSSPGFJWEA22AW4
blockId: concurrency/synchronized
relatedBlocks: []
question: synchronized 锁的到底是什么？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 两个线程分别调用同一类的静态和实例同步方法，互斥吗？
keyPoints:
  - id: kp-sy1-1
    text: 锁的是对象头里的 monitor（监视器），不是代码本身
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy1-2
    text: 修饰实例方法：锁当前对象 this
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy1-3
    text: 修饰静态方法：锁类的 Class 对象（全局唯一）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy1-4
    text: 同步代码块：锁括号里指定的对象
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

`synchronized` 的**锁是对象**，不是方法不是代码：

- **实例方法**上加：锁 **this**（这个实例）；
- **静态方法**上加：锁 **类的 Class 对象**（`Foo.class`，全 JVM 一份）；
- **代码块** `synchronized(obj)`：锁你指定的任意对象。

推论：**锁哪把，决定谁跟谁互斥**——两个线程调同一个实例的两个同步方法 → 同一把 this 锁 → 互斥；调不同实例的同步方法 → 各锁各的 this → **不互斥**；一个调静态一个调实例 → 一个锁 Class 一个锁 this → **不互斥**（高频陷阱）。

**术语速查**：monitor=对象头里的监视器锁｜this 锁=实例级｜Class 锁=类级全局唯一

<!--advanced-->
monitorenter/monitorexit 字节码（代码块）或 ACC_SYNCHRONIZED 标志（方法）。对象头 Mark Word 存 lock 状态位与持有线程；monitor 关联 ObjectMonitor（cxq/EntrySet/WaitSet）。静态与实例方法锁不同对象故天然不互斥——需要跨实例互斥用 Class 锁或外部锁对象。
