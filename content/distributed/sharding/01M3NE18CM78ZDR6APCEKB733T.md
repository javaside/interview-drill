---
id: 01M3NE18CM78ZDR6APCEKB733T
blockId: distributed/sharding
relatedBlocks: []
question: 分片键怎么选？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 商家维度查询怎么办？
keyPoints:
  - id: kp-sh2-1
    text: 高频查询条件优先：绝大多数查询能命中单片（免跨片扫描）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-sh2-2
    text: 用户 id/订单 id 常见——同用户数据同片（亲和）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-sh2-3
    text: 分布均匀：取模/hash 打散；range 利于范围但易热点
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-sh2-4
    text: 避免热点：单调递增主键做分片键=全写一片
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

分片键（sharding key）选择的**金标准：带着最贵的查询选**：

- **绝大多数查询的 WHERE 条件里有什么，就拿什么当分片键**——查询带上分片键 → 直达一片（**单点路由**）；不带 → **广播全部片**（N 倍开销）；
- 电商订单选**用户 id**（用户查自己订单是最高频路径，同用户订单同片）；**痛点**：商家维度查询（按商家查订单）不带用户 id → 广播——解法：**异构索引**（另存一份按商家 id 分片的表，写双份）/ 或把商家维度查询交给 ES/数仓；
- **分布与热点**：hash 取模打散均匀；range（按时间）利于范围查但**最新分片全是写**（热点）——时间场景常用「range+hash 复合」。

**术语速查**：单点路由=带分片键直达一片｜广播=查全部分片｜异构索引=为第二维度另存一份

<!--advanced-->
基因法（订单号嵌入用户 id 片段——两个维度都能路由）。分片键的不可变性（改键=数据搬家）。跨片事务（订单+库存分片不同——最终一致/Saga）。
