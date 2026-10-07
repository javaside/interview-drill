---
id: 01M3M7HTMBATQ8AZC2PFT8FR9G
blockId: jvm/gc-collectors
relatedBlocks: []
question: Minor GC、Major GC、Full GC 的区别？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 什么时候会触发 Full GC？
keyPoints:
  - id: kp-gc3-1
    text: Minor：只收新生代——频繁、快
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMA2ZKQQFCQ383RZBZY
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gc3-2
    text: Major：收老年代（CMS 的并发收集即此语义）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMA2ZKQQFCQ383RZBZY
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gc3-3
    text: Full：整堆加方法区的大扫除——最慢，调优目标是让它消失
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMA2ZKQQFCQ383RZBZY
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gc3-4
    text: Full 触发：老年代满、元空间满、担保失败、System.gc
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
---

按**扫哪儿**分三档：

- **Minor GC**：只收**新生代**——Eden 满即触发，频繁但**快**；
- **Major GC**：收**老年代**；
- **Full GC**：**整堆+方法区**全大扫除——**最慢**。调优的隐含目标是**让 Full 从监控里消失**。

**Full 的常见导火索**：老年代放不下晋升对象（**担保失败**）、元空间满、CMS 并发跟不上、显式 System.gc()（生产可 -XX:+DisableExplicitGC 禁掉——堆外内存依赖它的场景除外，用 ExplicitGCInvokesConcurrent 折中）。

**术语速查**：Minor=新生代快扫｜担保失败=老年代押不出新生代幸存者的空间｜显式 GC=代码里点的火

<!--advanced-->
空间分配担保：Minor 前检查老年代连续空间是否足够历次晋升均值，不足先 Full。System.gc 与 DirectByteBuffer Cleaner 的交互。G1 的 Young/Mixed 与 Full 语义。
