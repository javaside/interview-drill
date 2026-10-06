---
id: 01M3M7HTMA2ZKQQFCQ383RZBZY
blockId: jvm/memory-areas
relatedBlocks: []
question: 堆是怎么分代的？为什么分？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 新生代为什么是 8:1:1？
keyPoints:
  - id: kp-ma2-1
    text: 弱分代假说：绝大多数对象朝生夕死——按存活时间分区治理
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-ma2-2
    text: 新生代 = Eden + 两个 Survivor，Minor GC 的地盘
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-ma2-3
    text: 老年代：熬过多次 Minor 的对象与前置分配的大对象
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-ma2-4
    text: Minor 收新生代、Major 收老年代、Full 收全堆
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-ma2-5
    text: 晋升条件：年龄阈值（默认 15）或 Survivor 装不下
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
---

对象的**生死规律**很偏科：大部分活不过一轮 GC。堆按「**岁数**」分而治之：

- **新生代**（约堆 1/3）：**Eden**（新生落地）+ 两个 **Survivor**（幸存者中转）。Eden 满 → **Minor GC**（频繁、快——大部分当场死，没多少活的要搬）；
- **老年代**（约 2/3）：反复熬过 Minor 的长寿者（每熬一轮**年龄 +1**，到 15 晋升）与大对象直通车。老年代满 → **Major/Full GC**（慢，整堆大扫除）。

分代收益：**每种区域配最合适的算法**（新生代用复制——死的多人少搬家快；老年代用整理——防碎片）。

**术语速查**：分代=按存活时间分区｜年龄=熬过 Minor 的次数｜晋升=搬进老年代

<!--advanced-->
8:1:1 的依据：存活率通常低于 10%，两 Survivor 轮换（一空一活）。TLAB 让 Eden 分配无锁。动态年龄判定（同龄对象超 Survivor 一半即集体晋升）。G1/ZGC 以 Region/染色指针取代物理分代——逻辑分代仍在。
