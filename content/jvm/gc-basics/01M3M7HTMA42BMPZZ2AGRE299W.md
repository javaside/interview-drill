---
id: 01M3M7HTMA42BMPZZ2AGRE299W
blockId: jvm/gc-basics
relatedBlocks: []
question: 基础 GC 算法有哪三种？各适合哪代？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么新生代选复制、老年代选整理？
keyPoints:
  - id: kp-gb3-1
    text: 标记-清除：标完直接删——快但留碎片
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMB8JP9K8XMNWY4GCMW
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gb3-2
    text: 标记-复制：活对象搬走、旧区整体清零——无碎片但费空间
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gb3-3
    text: 标记-整理：标记后存活者向一端挪——无碎片但挪动贵
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMB8JP9K8XMNWY4GCMW
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gb3-4
    text: 存活少的新生代配复制；存活多的老年代配整理
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMA2ZKQQFCQ383RZBZY
      - 01M3M7HTMB44X28BZT234Y9BJH
      - 01M3M7HTMBATQ8AZC2PFT8FR9G
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
---

三种**基础姿势**：

- **标记-清除**：标出垃圾→直接删。**快**，但满地**碎片**（大对象没整块地→提前 Full GC）；
- **标记-复制**：把**活的**搬到空区，旧区**一锅端**。无碎片、分配快，**代价是空间闲置**；
- **标记-整理**：标记后存活者**向一端挤**。无碎片，但**挪对象贵**（引用全要改）。

**分代配方的由来**：新生代**死得多**——复制只搬少数幸存者，性价比之王；老年代**活得多**——复制要搬大半就亏，用整理（CMS 用清除忍碎片换低停顿）。

**术语速查**：碎片=空闲内存的洞｜指针碰撞=贴着上一对象分下一个｜整理=存活者挤到一边

<!--advanced-->
清除的碎片用 free list 管理（分配慢于 bump-the-pointer）。复制代价与存活率成正比。CMS 选清除的取舍：停顿优先、碎片由 Concurrent Mode Failure 兜底。ZGC 以染色指针+转发表实现并发整理。
