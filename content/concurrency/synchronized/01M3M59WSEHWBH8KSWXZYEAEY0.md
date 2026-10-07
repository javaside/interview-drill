---
id: 01M3M59WSEHWBH8KSWXZYEAEY0
blockId: concurrency/synchronized
relatedBlocks: []
question: 什么是死锁？怎么排查和预防？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 活锁和死锁的区别？
keyPoints:
  - id: kp-sy5-1
    text: 两个线程各持一把锁、互相要对方的，永久僵持
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy5-2
    text: 排查：jstack 抓线程 dump 看「Found one Java-level deadlock」；或 arthas/visualvm
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy5-3
    text: 预防 1：所有线程按相同顺序抢锁（全局锁排序）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CP02B6D8F0H2J4M6Q8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy5-4
    text: 预防 2：tryLock 带超时——拿不齐就放弃已持有的（打破持有并守候）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSECPRPA13YDV6NTXD7
      - 01M3NE18CP02B6D8F0H2J4M6Q8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

**死锁** = 互相持有对方所需、互不退让的**永久静止**：

```
线程A：拿着 锁1，要 锁2
线程B：拿着 锁2，要 锁1     // 双方各拿一半，谁也不撒手
```

**排查**：`jstack <pid>` 直接给出 Java-level deadlock 的环；Arthas 的 `thread -b` 一条命令揪出元凶。

**预防三板斧**：①**全局固定顺序抢锁**（都先 1 后 2，环不可能成）；②**tryLock+超时**（拿不齐就释放已有的重来，打破「持有并死候」）；③**缩小锁范围、减少嵌套**（压根不给成环的机会）。

**术语速查**：持有并守候=拿着一把再候另一把｜锁排序=全员同序｜jstack=线程快照工具

<!--advanced-->
Coffman 四条件（互斥/持有并守候/不可剥夺/循环守候），破任一即免死。哲学家用餐的 tryLock 回退（拿不齐全放）即破「持有并守候」。活锁=互相谦让重试永不进展（有 CPU 无推进）；饥饿=非公平下某线程长期抢不到。jstack 的 deadlock 检测基于 wait-for graph。
