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
    excludeAsDistractorFor:
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-ma3-3
    text: SOE 修代码（递归终止条件）；OOM 治容量或治泄漏
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-ma3-4
    text: '-Xss 调小则更浅的递归就爆栈；-Xmx 是堆 OOM 的顶'
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBH4404AEK6EXEEV9W
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
misconceptions:
  - id: mc-ma3-1
    text: "递归爆栈把 -Xss 调大就好，比改代码省事"
    why: "误解：病根是缺终止条件，扩栈只是把爆点推深；且每线程栈变大后能开的线程更少——药方是终止条件或改迭代"
  - id: mc-ma3-2
    text: "OOM 的消息一定是 Java heap space，看到 OOM 就是堆满"
    why: "误解：OOM 是家族病——Metaspace、Direct buffer memory、unable to create thread 都以 OOM 报；消息里的区域名才是分诊台"
  - id: mc-ma3-3
    text: "unable to create native thread 也是堆不够，把 -Xmx 加大就能解决"
    why: "误解：建线程耗的是每线程一份的本机栈内存与系统线程配额，都在堆外；加 -Xmx 救不了，反而挤占本机内存"
---

两个都是「装不下」，**病因相反**：

- **StackOverflowError（栈溢出）**：**空间小而固定**，塞爆它的是**深度**——递归没终止条件，栈帧层层压到超限。**药方在代码**（终止条件/改迭代）；
- **OutOfMemoryError（内存耗尽）**：塞爆它的是**体量**——堆装满对象（真需求大 or 泄漏）、元空间装满类、直接内存满、线程开太多。

排查口诀：OOM 先看**哪种**（消息带区域名：Java heap space / Metaspace / unable to create thread），再分「**调容量**（真不够）」还是「**抓泄漏**（该放的没放）」。

**术语速查**：SOE=深度病（递归）｜OOM=体量病（容量/泄漏）｜区域名=OOM 消息关键词

<!--advanced-->
OOM 家族：GC overhead limit exceeded（98% 时间 GC）、Metaspace（CGLib 滥生成类）、Direct buffer memory、unable to create native thread（线程数乘栈 vs ulimit）。-XX:+HeapDumpOnOutOfMemoryError 留 dump 是第一现场。
