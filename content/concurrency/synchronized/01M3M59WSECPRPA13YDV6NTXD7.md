---
id: 01M3M59WSECPRPA13YDV6NTXD7
blockId: concurrency/synchronized
relatedBlocks: []
question: synchronized 和 ReentrantLock 怎么选？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 什么场景必须上 ReentrantLock？
keyPoints:
  - id: kp-sy4-1
    text: synchronized：语法级，自动释放（异常也不漏），JIT 持续优化——默认选择
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSF16SCYSM5EVS1C59W
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy4-2
    text: ReentrantLock：tryLock 尝试获取/超时获取、可中断、公平锁
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEHWBH8KSWXZYEAEY0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy4-3
    text: ReentrantLock 支持多条件队列（多个 Condition 精准唤醒）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEHSMWYDSYW8CRMY0F
      - 01M3M59WSFQ6DJYJ18QPFWZQBD
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy4-4
    text: RLL 必须手动 unlock 且放 finally；忘了就是灾难
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

**默认 synchronized**——语法简单（异常自动解锁）、JVM 持续优化（锁升级），够用就别换。

**ReentrantLock 的三大独门武器**（对上需求才换）：

1. **tryLock()**：抢不到锁**不阻塞**（或限时/可中断）——「拿不到就走别的路」的弹性；
2. **公平锁**：`new ReentrantLock(true)` 按排队顺序发放（默认同 synchronized 一样非公平）；
3. **多个 Condition**：一把锁挂多个候场室，`await/signal` **精准唤醒**某一类线程（synchronized 只有一间 WaitSet 全体广播）。

代价：**必须 try-finally 手动 unlock**——忘写就是锁泄漏。

**术语速查**：tryLock=抢不到就走｜公平=先来先得｜Condition=分房间精准唤醒｜锁泄漏=忘 unlock 永久占用

<!--advanced-->
性能差距在现代 JIT 下已大幅收敛（偏向/轻量对无竞争优化深），选型以功能为准。RLL 的 lockInterruptibly 使中断可打破抢锁阻塞（synchronized 抢锁不可中断）。Condition await 释放锁入队；signal 需持锁调用。读写场景上 ReentrantReadWriteLock / StampedLock（乐观读）。
