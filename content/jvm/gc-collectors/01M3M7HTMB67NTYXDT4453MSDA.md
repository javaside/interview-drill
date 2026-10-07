---
id: 01M3M7HTMB67NTYXDT4453MSDA
blockId: jvm/gc-collectors
relatedBlocks: []
question: ZGC 为什么能做到亚毫秒停顿？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 染色指针是什么？
keyPoints:
  - id: kp-gc2-1
    text: 标记、转移、重定位几乎全并发——STW 只剩根扫描瞬时
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMB44X28BZT234Y9BJH
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gc2-2
    text: 染色指针：64 位指针高位存标记与转移位——对象自带 GC 元数据
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gc2-3
    text: 读屏障：业务读到过期引用时顺路修正到新地址（自愈）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gc2-4
    text: 吞吐代价约 5-10%（CPU 换停顿），TB 级堆停顿仍亚毫秒
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMB44X28BZT234Y9BJH
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
---

ZGC 的野心：**停顿与堆大小无关**（16TB 堆也亚毫秒）。三板斧：

1. **染色指针**：64 位指针的**高位 bit 被征用**存「颜色」（标记/转移状态）——对象**自己携带 GC 状态**，不用查旁表；
2. **并发转移**：对象搬家**不等 STW**——旧位置留「新地址便签」（转发表）；
3. **读屏障**：业务线程读到**旧地址**引用时，**顺路改到新地址**（「自愈」——每个引用只修一次，全员自愈完成）。

代价：读屏障+并发搬运烧 CPU（吞吐让 5~10%）；换来**极低且平稳**的延迟——大堆低延迟场景的标配。

**术语速查**：染色指针=指针里存 GC 状态｜转发表=旧地址到新地址的便签｜自愈=读到旧引用顺手修正

<!--advanced-->
多重映射（虚拟地址多映射同一物理页）让多色共存。分代 ZGC（21）补上年轻代并发复制。Shenandoah 的 Brooks 转发指针是另一条自愈路线。
