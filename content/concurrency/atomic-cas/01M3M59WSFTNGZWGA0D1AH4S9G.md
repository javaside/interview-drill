---
id: 01M3M59WSFTNGZWGA0D1AH4S9G
blockId: concurrency/atomic-cas
relatedBlocks: []
question: 什么是 ABA 问题？怎么解决？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - GC 与 ABA 有什么关系？
keyPoints:
  - id: kp-ac3-1
    text: 值 A 到 B 再回 A：CAS 只看当前值，感知不到中途变过
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-ac3-2
    text: 数值场景多数无害；引用场景可能拿回「同值不同命」的对象
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-ac3-3
    text: 解法：版本戳——AtomicStampedReference 值与版本双比对
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-ac3-4
    text: 无锁栈的典型受害：A 弹出后复用同地址再压回
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-ac3-5
    text: 版本戳比对要求调用方成对传入引用与整型戳
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
---

**ABA**：CAS 比对时值「看起来还是 A」——但它中间**变成过 B 又变回来了**。数值场景多半无所谓（结果一样）；**引用**场景致命：栈顶弹出 A 后，别的线程把**同地址的新对象**压回去——CAS 成功了，链却断在别人口袋里。

**解法：带版本**——AtomicStampedReference 把「值 + 版本号」捆在一起比：值回去了版本也涨了，CAS 拒绝。Java 有 GC 兜着「活对象地址不复用」，但无锁结构里的节点回收复用仍可能中招。

**术语速查**：ABA=变了又变回｜版本戳=每次改动加一的防伪码｜同值不同命=值一样对象已换

<!--advanced-->
AtomicMarkableReference 是布尔戳简化版。hazard pointer（jctools）与 epoch 基回收是无锁结构正解。concurrent 栈/队列的 removed-node 复用是 Java 里的真实 ABA 面。
