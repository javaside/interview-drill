---
id: 01M3NE18CM7FPX5TGQH5R1Z7Z5
blockId: distributed/sharding
relatedBlocks:
  []
question: "分片后的跨片查询和分页怎么做？"
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 跨片深分页有多惨？
keyPoints:
  - id: kp-sh3-1
    text: "路由式：带分片键——直达单片，与单表无差"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-sh3-2b
    text: "广播式：不带分片键——各片查一遍再聚合（fan-out）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-sh3-3
    text: "跨片分页：各片取前 N 条 → 内存归并排序取全局前 N"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-sh3-4
    text: "深翻页灾难：各片要取 offset+N 条——全局页码越大片内取越多"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-sh3-5
    text: "解法：禁止跳页（连续翻页游标）/ ES 承担复杂查询"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
---

分片后的查询三形态：

1. **带分片键**：直奔目标片——爽；
2. **不带**：**广播**（fan-out）——N 片并发查、内存**归并**——慢但能扛；
3. **跨片分页**是广播里最痛的：查「全局第 100 页（每页 20）」→ **每片都得取自己前 100×20=2000 条** → 内存归并再丢掉 1980 条——**页码越深每片取越多**（limit 1000000,10 的分片版灾难）。

解法两路：①**产品层禁止跳页**——只能连续下一页（记住上一页末尾 id 的游标式：各片 `where id > last` 取 20 条归并——开销恒定）；②**复杂查询外移**——同步到 ES/ClickHouse 专门伺候多维查询与翻页（分片库只做 OLTP 点/简查）。

**术语速查**：fan-out=全片并发查｜归并=内存合流排序｜游标翻页=开销恒定的下一页

<!--advanced-->
异构双写的一致性（binlog 同步到 ES 的最终一致窗口）。全局唯一排序键的必要性（归并比较依据）。二次查询法（先查 id 再回查详情——省宽行传输）。
