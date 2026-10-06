---
id: 01M3M59WSEGT88KDJP0EBP8G5W
blockId: concurrency/volatile-jmm
relatedBlocks: []
question: happens-before 是什么？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 它和时间的先后是一回事吗？
keyPoints:
  - id: kp-vj3-1
    text: JMM 的可见性契约：A happens-before B，则 A 的结果对 B 可见且有序
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj3-2
    text: 程序次序：单线程内按代码顺序
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj3-3
    text: 解锁 先行于 后续加锁；volatile 写 先行于 后续读；start/join 先行规则
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj3-4
    text: 传递性：A→B、B→C 则 A→C（跨点接力组合出全局顺序）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

**happens-before（先行发生）** 是 JMM 给开发者的**承诺**，不是时间上的先后：

> 如果 A **happens-before** B，那么 A 的效果（写过的变量）对 B **保证可见、保证有序**。

**时间上早发生 ≠ happens-before**：没有 HB 关系的两次操作，可见性**不作任何承诺**（可能看到也可能看不到——「看到了」只是运气）。HB 的几个核心来源：程序次序（单线程内）、**解锁→加锁**、**volatile 写→读**、**start→线程内任意**、**线程内任意→join**，再靠**传递性**串成链。

写并发代码 = 用这些规则**证明**「我的写对方一定看得到」；证明不出来就是 bug。

**术语速查**：HB=可见性的承诺链｜程序次序=单线程代码序｜传递性=链式接力｜时间先后≠HB

<!--advanced-->
HB 是偏序（非全序）；无 HB 关系的操作可任意重排+可见性未定。volatile/JMM 规范（JSR-133）用 HB 替代此前的主从内存弱模型。final 字段的构造 HB（正确发布下免同步可见）是单独的豁免通道。data race 定义：无 HB 的冲突访问（同变量一读一写/两写）。
