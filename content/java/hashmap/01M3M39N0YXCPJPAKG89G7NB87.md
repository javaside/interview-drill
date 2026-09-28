---
id: 01M3M39N0YXCPJPAKG89G7NB87
blockId: java/hashmap
relatedBlocks:
  - java/collections-overview
question: "HashMap 的 hash 扰动函数为什么那样设计？"
cardType: atomic
appliesTo: Java 17+
frequency: high
followUps:
  - 不扰动会怎样？
keyPoints:
  - id: kp-hm2-1
    text: "h = key.hashCode() ^ (h >>> 16)：高 16 位异或进低 16 位，让高位也参与定位"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

定位下标只用了 hash 的**低几位**（`(n-1) & hash`，n=16 时就是低 4 位）。如果 key 的 hash **只有高位有差异**（常见于内存地址连续的小对象），低 4 位全一样 → 全挤进**同一个桶**。

扰动函数 `(h ^ h>>>16)` 把**高 16 位的信息混进低 16 位**——差异藏在高位的 key 也能被打散。代价仅一次移位异或，几乎白赚。

**术语速查**：扰动=高低位异或混合｜低位定桶=下标只看低几位

<!--advanced-->
移位 16 对 32 位 hash 恰好对半混合（再移信息冗余）。对比 1.7 的多次移位+乘法（4 次扰动），8 的单次在速度与分布间取平衡。此函数同时服务 HashMap 与 ConcurrentHashMap（spread）。
