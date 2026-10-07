---
id: 01M3M59WSF16SCYSM5EVS1C59W
blockId: concurrency/atomic-cas
relatedBlocks: []
question: CAS 和互斥锁怎么选？
cardType: judgment
conclusion: depends
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么说 CAS 是乐观锁？
keyPoints:
  - id: kp-ac4-1
    text: 低竞争且临界区极小：CAS 无挂起开销，完胜
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEP0BGWBNR944YKH0G
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-ac4-2
    text: 高竞争或临界区长：自旋空转烧 CPU，互斥锁排队挂起更划算
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEP0BGWBNR944YKH0G
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-ac4-3
    text: 多变量一致性：CAS 只保单点，多变量必须锁或整体替换引用
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEP0BGWBNR944YKH0G
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
---

**看竞争烈度和临界区长度**：

- **低竞争 + 临界区就几行**：CAS（乐观派——「冲突是 rare 的，撞了再说」）不挂起不进内核，完胜；
- **高竞争**：CAS 的「撞了重试」变成**全员空转烧 CPU**；互斥锁（悲观派——「先锁再说」）让失败者**睡过去**（不占 CPU），反而高效；
- **多个变量要保持一致**：CAS 一次只保一个变量——多变量原子性只能锁（或打包成单对象做引用 CAS 的不可变更新）。

**术语速查**：乐观=撞了再重试｜悲观=先锁后动｜多变量一致性=CAS 的天生短板

<!--advanced-->
synchronized 的锁升级即自动混排（无竞争偏向轻量=乐观 CAS，竞争重=重量挂起）。LongAdder 的分散是第三条路（消解竞争本身）。不可变快照 + AtomicReference 整体替换是多变量无锁的通用模式（copy-on-write 思想）。
