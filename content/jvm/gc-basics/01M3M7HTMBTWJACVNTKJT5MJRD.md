---
id: 01M3M7HTMBTWJACVNTKJT5MJRD
blockId: jvm/gc-basics
relatedBlocks:
  []
question: "什么是三色标记？并发标记为什么会漏标？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - CMS 和 G1 分别怎么解漏标？
keyPoints:
  - id: kp-gb5-1
    text: "白=未扫、灰=自身已扫但其引用未扫完、黑=完全扫毕"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-gb5-2
    text: "漏标两条件同时成立：黑新增指向白 且 灰到白的旧路径被删"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-gb5-3
    text: "增量更新：黑对象加新引用时退回灰（CMS 采用）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-gb5-4
    text: "SATB：按开扫时刻的快照判活——删掉的当仍活着（G1 采用）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-gb5-5
    text: "漏标后果：活对象被误收——悬挂引用与下轮幽灵数据"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
---

并发标记（GC 扫对象时**业务还在跑**）用**三色**记账：**白**（候选垃圾）、**灰**（自己扫完、引用没扫完）、**黑**（彻底结案）。

**漏标**只在两个条件**同时**发生时出现：①**黑**对象**新增**指向**白**对象的引用；②**灰→白**的旧路径**被删光**。黑不再被扫——白对象被误收（**活人被收尸**）。

两副解药：**增量更新**（黑敢加引用就**打回灰**——CMS）；**SATB 原始快照**（开扫那刻的引用全保——删的也**当活着**，宁可漏收不误杀——G1）。

**术语速查**：三色=扫描进度色笔｜漏标两条件=新增黑到白 且 断灰到白｜SATB=按快照判活

<!--advanced-->
写屏障拦截引用变更记入队列。增量更新保「新引用必被扫」；SATB 记被删引用保「旧对象不丢」。浮动垃圾（SATB 的多收残留）由下轮兜底。Remark 处理队列残余。
