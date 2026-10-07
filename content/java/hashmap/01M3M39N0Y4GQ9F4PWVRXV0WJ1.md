---
id: 01M3M39N0Y4GQ9F4PWVRXV0WJ1
blockId: java/hashmap
relatedBlocks:
  - java/collections-overview
question: HashMap 的扩容（resize）过程是怎样的？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么负载因子是 0.75？
keyPoints:
  - id: kp-hm3-1
    text: 负载因子 0.75：size > cap × 0.75 触发扩容，容量翻倍
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CMCYRK8M2K2GAK4BY5
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-hm3-2
    text: 容量恒为 2 的幂（tableSizeFor 向上取），翻倍后保持
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CMCYRK8M2K2GAK4BY5
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-hm3-3
    text: JDK8 拆链优化：节点按 hash 新增那位是 0/1 分成两条原序子链（不再重算 hash）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0Y173S2T5DGGRY61MJ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-hm3-4
    text: 扩容是全量搬迁：默认初始 16，大量数据建议预估 initialCapacity
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CMCYRK8M2K2GAK4BY5
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

装到 **75% 满**（size > 16×0.75=12）就搬家：容量**翻倍**（2 的幂序列 16→32→64…），所有元素**重新分桶**。

JDK8 的聪明处——**拆链**：翻倍后每个 key 的新位置只有两种可能（多出来的那位 bit 是 0 → 留原桶；是 1 → 去「原下标+旧容量」），**不用重算 hash**，把原链按这一位劈成两条、各自整体平移。1.7 的重新散列+头插就慢且危险得多。

**术语速查**：负载因子=多满才扩｜拆链=按新增位一分为二｜原序平移=子链内部顺序不变

<!--advanced-->
0.75 是空间/时间折中的经验值（泊松期望下链冲突率可控）。树化节点在 resize 中 split 成 lo/hi 两条树链（保持/去低位或高位），退树判定同时发生。初始容量公式：预期 size / 0.75 + 1 再取 2 的幂。
