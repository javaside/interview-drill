---
id: 01M3M7HTMAARH72QH9X6XSQBN7
blockId: jvm/memory-areas
relatedBlocks: []
question: StackOverflowError 和 OutOfMemoryError 的区别？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 怎么构造一个堆 OOM？
keyPoints:
  - id: kp-ma3-1
    text: SOE：栈深超限——递归失控的典型信号（空间固定小）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-ma3-2
    text: OOM：空间不够装——堆满/元空间满/直接内存满/线程过多
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-ma3-3
    text: SOE 修代码（递归终止条件）；OOM 治容量或治泄漏
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-ma3-4
    text: '-Xss 调小则更浅的递归就爆栈；-Xmx 是堆 OOM 的顶'
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
---

两个都是「装不下」，**病因相反**：

- **StackOverflowError（栈溢出）**：**空间小而固定**，塞爆它的是**深度**——递归没终止条件，栈帧层层压到超限。**药方在代码**（终止条件/改迭代）；
- **OutOfMemoryError（内存耗尽）**：塞爆它的是**体量**——堆装满对象（真需求大 or 泄漏）、元空间装满类、直接内存满、线程开太多。

排查口诀：OOM 先看**哪种**（消息带区域名：Java heap space / Metaspace / unable to create thread），再分「**调容量**（真不够）」还是「**抓泄漏**（该放的没放）」。

**术语速查**：SOE=深度病（递归）｜OOM=体量病（容量/泄漏）｜区域名=OOM 消息关键词

<!--advanced-->
OOM 家族：GC overhead limit exceeded（98% 时间 GC）、Metaspace（CGLib 滥生成类）、Direct buffer memory、unable to create native thread（线程数乘栈 vs ulimit）。-XX:+HeapDumpOnOutOfMemoryError 留 dump 是第一现场。
