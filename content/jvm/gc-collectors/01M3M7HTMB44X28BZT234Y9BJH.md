---
id: 01M3M7HTMB44X28BZT234Y9BJH
blockId: jvm/gc-collectors
relatedBlocks: []
question: 各收集器怎么选？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 吞吐优先和延迟优先怎么权衡？
keyPoints:
  - id: kp-gc5-1
    text: 吞吐优先：Parallel 系——批处理与后台计算
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gc5-2
    text: 延迟敏感在线服务（默认推荐）：G1
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gc5-3
    text: 超大堆或超低停顿：ZGC 与 Shenandoah
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gc5-4
    text: 收集器与区域搭配有约束（CMS 不能配 Parallel Scavenge）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
misconceptions:
  - id: mc-gc5-1
    text: "JDK 17 服务端的默认收集器还是 Parallel Scavenge，要低延迟才需要手动换 G1"
    why: "误解：9 起服务端默认就是 G1；Parallel 只在吞吐优先的批处理场景才值得显式选用"
  - id: mc-gc5-2
    text: "追求高吞吐就选 ZGC——停顿最短就代表干活效率最高"
    why: "误解：ZGC 拿 CPU 换停顿，吞吐反而要让出 5-10%；总时间最短的吞吐型任务该选 Parallel 系"
  - id: mc-gc5-3
    text: "JDK 17 里低停顿需求首选 CMS，它经过多年生产验证"
    why: "误解：CMS 在 9 被废弃、14 被移除，17 里根本选不到；超低停顿要上 ZGC 或 Shenandoah"
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
