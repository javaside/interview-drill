---
id: 01M3M59WSEP0BGWBNR944YKH0G
blockId: concurrency/volatile-jmm
relatedBlocks: []
question: CAS 是什么？有什么问题？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么 CAS 比加锁快？
keyPoints:
  - id: kp-vj5-1
    text: Compare-And-Swap：比较内存值与预期，相同则换成新值——CPU 级原子指令
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj5-2
    text: 乐观策略：不加锁，失败就重试（自旋）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj5-3
    text: ABA 问题：值 A→B→A，CAS 察觉不到中途变化——版本号/AtomicStampedReference 解决
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj5-4
    text: 自旋失败率高时烧 CPU（长期抢不过就该上锁/LongAdder）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

**CAS（比较并交换）** 是 CPU 的一条**原子指令**：

```
CAS(内存地址, 期望值, 新值)：
  若 地址上的值 == 期望值 → 写入新值，返回成功
  否则 → 什么都不做，返回失败
```

Java 的 `AtomicInteger.incrementAndGet()` 就是「读旧值 → CAS(旧, 旧+1)，失败重试」的**自旋**——**不挂起线程、不让内核**，无竞争/低竞争时比锁快得多。

两个坑：**ABA**（A 改 B 又改回 A，CAS 以为没动过——带版本号的 `AtomicStampedReference` 识别）；**高竞争自旋**（一直失败一直转，白烧 CPU——热点计数换 LongAdder 分散格子）。

**术语速查**：CAS=比较+换的原子指令｜自旋=失败立刻重试｜ABA=中途变过又变回｜版本号=戳出真身

<!--advanced-->
x86 的 lock cmpxchg（前缀锁缓存行）、ARM 的 LL/SC 对。Unsafe.compareAndSwapInt → VarHandle 的 acquire/release 语义分层。GC 与 ABA 的关联：引用回收重用同地址。LongAdder 的 cell 即「空间换自旋冲突」；高竞争下 CAS 吞吐塌缩（单点热点）由分散计数根治。
