---
id: 01M3M7HTMB44X28BZT234Y9BJH
blockId: jvm/gc-collectors
relatedBlocks:
  []
question: "各收集器怎么选？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 吞吐优先和延迟优先怎么权衡？
keyPoints:
  - id: kp-gc5-1
    text: "吞吐优先：Parallel 系——批处理与后台计算"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-gc5-2
    text: "延迟敏感在线服务（默认推荐）：G1"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-gc5-3
    text: "超大堆或超低停顿：ZGC 与 Shenandoah"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-gc5-4
    text: "收集器与区域搭配有约束（CMS 不能配 Parallel Scavenge）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
---

按**要什么**分三派：

| 你要什么 | 选谁 | 场景 |
|---|---|---|
| **吞吐**（总时间最短） | Parallel Scavenge+Old | 离线批处理 |
| **平衡**（可控停顿） | **G1**（8u+ 默认） | 绝大多数在线服务 |
| **极低停顿** | ZGC / Shenandoah | 大堆低延迟 |

搭配铁律：**收集器和区域是配对的**（Serial↔Serial Old、ParNew↔CMS）——9 之后统一向 G1/ZGC 收敛。

**术语速查**：吞吐=干活时间占比｜停顿=每次卡多久｜搭配约束=新老收集器要成对

<!--advanced-->
Parallel 的目标驱动自适应（GCTimeRatio/MaxGCPauseMillis 的 ergonomic）。ZGC 15 生产、分代 21。虚拟线程时代（21+）的 GC 压力面转移带来的选型微调。
