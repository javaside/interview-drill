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
    excludeAsDistractorFor:
      - 01M3NE18CM7FPX5TGQH5R1Z7Z5
      - 01M3NE18CNQFGY7ZQBDA3P1QXB
      - 01M3NE18CNYXR11H0D7PRZ1EMN
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-sh2-2
    text: 用户 id/订单 id 常见——同用户数据同片（亲和）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CM7FPX5TGQH5R1Z7Z5
      - 01M3NE18CMATBK5C1308CM5A5V
      - 01M3NE18CNYXR11H0D7PRZ1EMN
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-sh2-3
    text: 分布均匀：取模/hash 打散；range 利于范围但易热点
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNQFGY7ZQBDA3P1QXB
      - 01M3NE18CNYXR11H0D7PRZ1EMN
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-sh2-4
    text: 避免热点：单调递增主键做分片键=全写一片
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNQFGY7ZQBDA3P1QXB
      - 01M3NE18CNYXR11H0D7PRZ1EMN
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
misconceptions:
  - id: mc-sh2-1
    text: "查询不带分片键也没关系，中间件会广播到全部分片并行执行，性能与单片路由没有差别"
    why: "误解：广播的开销随分片数线性放大、还要内存归并；分片键的意义就是让高频查询直奔单片，不带键的查询只能靠异构索引或 ES 兜底"
  - id: mc-sh2-2
    text: "订单表用订单 id 做分片键后，用户查自己的订单列表同样能单片直达"
    why: "误解：按订单 id 散列，同一用户的多笔订单会散到不同片，用户维度查询退化为广播；两个维度都要直达得靠基因法或按用户 id 另建异构索引"
  - id: mc-sh2-3
    text: "分片键选得不合适也不要紧，上线后换一个键，迁移工具会自动把数据搬过去"
    why: "误解：分片键决定数据的物理归属，换键意味着全量数据重新分布——停机搬家或双写灰度都代价高昂，分片键要在设计期一次定准"
---

分片键（sharding key）选择的**金标准：带着最贵的查询选**：

- **绝大多数查询的 WHERE 条件里有什么，就拿什么当分片键**——查询带上分片键 → 直达一片（**单点路由**）；不带 → **广播全部片**（N 倍开销）；
- 电商订单选**用户 id**（用户查自己订单是最高频路径，同用户订单同片）；**痛点**：商家维度查询（按商家查订单）不带用户 id → 广播——解法：**异构索引**（另存一份按商家 id 分片的表，写双份）/ 或把商家维度查询交给 ES/数仓；
- **分布与热点**：hash 取模打散均匀；range（按时间）利于范围查但**最新分片全是写**（热点）——时间场景常用「range+hash 复合」。

**术语速查**：单点路由=带分片键直达一片｜广播=查全部分片｜异构索引=为第二维度另存一份

<!--advanced-->
基因法（订单号嵌入用户 id 片段——两个维度都能路由）。分片键的不可变性（改键=数据搬家）。跨片事务（订单+库存分片不同——最终一致/Saga）。
