---
id: 01M3NE18CM3PYDPV0D8474B4VG
blockId: distributed/sharding
relatedBlocks:
  []
question: "分库分表的扩容（数据迁移）怎么做？"
cardType: sequence
appliesTo: 通用
frequency: high
followUps:
  - 为什么要双写不直接切？
keyPoints:
  - id: kp-sh4-1
    text: "第 1 步 双写：新旧两套同时写（旧为主）"
    public: false
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-sh4-2
    text: "第 2 步 存量迁移：历史数据批量刷到新表（增量靠双写追平）"
    public: false
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-sh4-3
    text: "第 3 步 校验：新旧数据比对（抽样+全量 checksum）"
    public: false
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-sh4-4
    text: "第 4 步 切读：灰度把读流量切到新表（可回滚）"
    public: false
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-sh4-5
    text: "第 5 步 收尾：全量切换后停写旧表，观察期后下线"
    public: false
    order: 5
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
---

**平滑扩容五步法**（不停机迁移的工业标准，按序排）：

```
①双写（新旧都写，旧为主）→ ②存量批量迁移 → ③数据校验比对
→ ④灰度切读（5%→50%→100%，随时可回）→ ⑤切写、停旧、观察下线
```

**为什么要双写而不是直接切**：迁移期间**业务还在写**——只迁存量，迁移中的新写会丢；双写保证**增量实时进新表**，校验补齐差异。**灰度切读**是安全带：新表逻辑有 bug 只影响 5% 流量，一秒回滚到旧表。

**翻倍扩容的小技巧**：2 库扩 4 库——若原为 `id%2`，扩成 `id%4` 时旧数据 `id%4∈{0,1}` 恰好落在每旧库拆出的两个新库——**只需库内一半迁移**（一致性 hash 同思路）。

**术语速查**：双写=过渡期两边记账｜校验=对账差异补齐｜灰度切=带安全带换发动机

<!--advanced-->
双写的一致性兜底（写失败入补偿表/以 binlog 为准对齐）。ShardingSphere 的 resharding 与 online schema change（gh-ost 的影子表+binlog 同思路）。
