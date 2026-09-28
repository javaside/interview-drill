---
id: 01M3M59WSFMHAG2JTWE04XH3N0
blockId: concurrency/atomic-cas
relatedBlocks:
  []
question: "LongAdder 为什么比 AtomicLong 快？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 什么时候仍该用 AtomicLong？
keyPoints:
  - id: kp-ac2-1
    text: "AtomicLong：单点 CAS——N 线程全在一个变量上自旋互踩"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'juc'
  - id: kp-ac2-2
    text: "LongAdder：base 加 Cell 数组分散格子——冲突时换格子各自累加"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'juc'
  - id: kp-ac2-3
    text: "sum 时才把 base 与全格子求和（弱一致瞬时值）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'juc'
  - id: kp-ac2-4
    text: "场景：统计计数、监控打点——只加少读的热点"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'juc'
---

计数器的**堵与疏**：

- **AtomicLong**：所有线程在**同一个格子** CAS——高并发下大量失败重试（排队排到 CPU 烧）；
- **LongAdder**：一个 base 打底，冲突了就**分散到 Cell 数组各自的格子里加**——各加各的互不踩；要总数时 sum() 把 base 加所有格子**算一遍**。

代价：sum 是**某一瞬的弱一致值**（求和时别的线程还在加）。所以要**精确读改写**（CAS 语义、比较后决定）→ AtomicLong；**纯计数、偶尔读**（监控、QPS）→ LongAdder 完胜。

**术语速查**：单点自旋=全挤一个门｜分散格子=多开几个门各排各队｜弱一致求和=算的是瞬时照片

<!--advanced-->
Cell 用 @Contended 避免伪共享（独占缓存行）。ConcurrentHashMap 的 counterCells 即此思想。striped 理念：HotSpot 的 @Contended 与 -XX:-RestrictContended。
  - id: kp-ac2-5
    text: "sum 的弱一致换 O(1) 写入：读少写多的吞吐契约"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'juc'

