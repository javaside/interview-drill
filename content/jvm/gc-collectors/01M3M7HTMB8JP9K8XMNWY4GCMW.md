---
id: 01M3M7HTMB8JP9K8XMNWY4GCMW
blockId: jvm/gc-collectors
relatedBlocks: []
question: CMS 和 G1 的核心区别？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - CMS 的 Concurrent Mode Failure 是什么？
keyPoints:
  - id: kp-gc1-1
    text: CMS：老年代低停顿收集器，标记-清除（有碎片）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gc1-2
    text: G1：整堆 Region 化，整理+复制，停顿可预测
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gc1-3
    text: G1 按停顿预算选收益最高的 Region 回收（MaxGCPauseMillis）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gc1-4
    text: CMS 碎片最终触发并发失败退化 Serial Old——9 废弃、14 移除
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
---

两代「低停顿」代表：

- **CMS**：**并发**标记清除老年代——扫和清大多与业务同跑（停顿只剩初始/重新标记两小段）。死穴：**清除留碎片**——放不下大对象时触发 **Concurrent Mode Failure** 退化成 Serial Old 单线程整理（一场超长 STW）；
- **G1**：堆切成等大 **Region**（1-32MB）——回收时挑**垃圾最多**的 Region 先收（Garbage First 之名）。整理+复制无碎片，且**停顿可预算**：设 MaxGCPauseMillis=200，G1 按统计挑够预算的 Region 数量。

**选型实践**：JDK 8 堆 6G+ 或 9+ 直接 G1；超大堆/超低停顿上 ZGC。

**术语速查**：并发=GC 与业务同跑｜Region=堆的等大积木｜停顿预算=按目标时间挑积木

<!--advanced-->
CMS 四阶段（Initial Mark STW、Concurrent、Remark STW、Sweep）；失败条件：并发清理期老年代被填满。G1 的 SATB、CSet、RSet 与 Mixed GC。8G+ 建议 G1 且避免 Humongous 直配。
