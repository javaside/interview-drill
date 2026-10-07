---
id: 01M3NE18CMWD29BXAW3HXSKTGP
blockId: distributed/sharding
relatedBlocks: []
question: 什么时候需要分库分表？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 单表 2000 万行一定要拆吗？
keyPoints:
  - id: kp-sh1-1
    text: 信号：单表行数过大（数千万级 B+ 树变高）、单库写 QPS 到顶、磁盘容量受限
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNQFGY7ZQBDA3P1QXB
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-sh4-6
    text: 先穷尽低代价方案：索引优化/读写分离/缓存/归档冷数据
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CMDD5CJ936BEH04P60
      - 01M3NE18CNQFGY7ZQBDA3P1QXB
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-sh4-7
    text: 垂直拆分（按业务/字段）优先于水平拆分（按行）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-sh4-4x
    text: 分库解决写与容量；分表解决单表大小——两者独立可组合
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNQFGY7ZQBDA3P1QXB
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

**拆分是最后手段**——先问三个更便宜的问题：

1. **索引优化**了吗（慢查询是不是缺索引/烂索引）；
2. **读写分离**了吗（读多写少场景先加从库）；
3. **缓存/归档**了吗（热数据进缓存、三年前的订单归档走冷存储）。

都做完仍顶不住（**单表数千万行 B+ 树层数变高、写入 QPS 单库到顶、磁盘吃紧**）才动手拆：

- **垂直分库**：按业务域拆（订单库/商品库/用户库）——**微服务的数据自治一步**；
- **垂直分表**：宽表拆冷热（高频小字段一张、大字段一张）；
- **水平分库分表**：按行拆（订单 id 取模散到 16 库 64 表）——**解决单库写与单表容量**的终极手段。

**注意**：2000 万不是魔法数——**B+ 树三层的高度极限**才是实质（行宽不同阈值差很远），官方口径也只说「建议 2000 万以下保持舒适」。

**术语速查**：读写分离先于拆库｜垂直=按业务/字段切｜水平=按行散

<!--advanced-->
B+ 树高度与页分裂的容量数学（16KB 页×三层×每页 120 指针）。TiDB/oceanbase 的分布式原生方案（应用免拆分——用分布式存储换业务简单性）。ES/ClickHouse 承担查询侧的 CQRS 拆分。
