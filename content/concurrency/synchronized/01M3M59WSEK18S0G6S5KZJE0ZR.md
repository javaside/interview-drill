---
id: 01M3M59WSEK18S0G6S5KZJE0ZR
blockId: concurrency/synchronized
relatedBlocks: []
question: synchronized 是可重入的吗？怎么实现？
cardType: judgment
conclusion: 'yes'
appliesTo: Java 17+
frequency: high
followUps:
  - 如果不可重入会怎样？
keyPoints:
  - id: kp-sy3-1
    text: 可重入：同一线程可重复获取自己已持有的锁，不会把自己锁死
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy3-2
    text: 实现：monitor 记录持有线程 id 与计数器，重入 +1、退出 -1，归零才真正释放
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy3-3
    text: 价值：同步方法互相调用（a() 调 b()）不会自锁
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

**是可重入的**——同一线程拿过的锁，可以**再拿**：

```java
synchronized void a() { b(); }   // b 也是 synchronized（同 this）
synchronized void b() { … }      // 若不可重入：a 持锁调 b 再抢锁 → 自己排队自己 → 死锁
```

机理：monitor 里记着**持有线程 id + 计数器**——同线程再进来只 +1 不阻拦，方法退出 -1，**减到 0 才真正放锁**。这是「同步方法链式调用」能工作的前提。

**术语速查**：可重入=自己的锁可以反复拿｜计数器=进 +1 出 -1｜自锁=自己排队自己

<!--advanced-->
ReentrantLock 同名即此语义（AQS 的 exclusiveOwnerThread + state 计数）。可重入是「线程维度」的：不同线程仍互斥。递归方法里的 synchronized 天然依赖此性质。ReentrantReadWriteLock 的读锁重入 + 写锁可降级为读，写读互斥方向要记清。
