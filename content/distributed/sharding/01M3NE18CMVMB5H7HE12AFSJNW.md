---
id: 01M3NE18CMVMB5H7HE12AFSJNW
blockId: distributed/sharding
relatedBlocks:
  []
question: "分库分表后的分布式 ID 和事务？"
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 跨片 join 怎么替代？
keyPoints:
  - id: kp-sh5-1
    text: "自增 id 不可用：各分片会撞号——雪花/号段接管"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-sh5-2
    text: "跨片事务不能靠单库——本地消息表/Saga 最终一致"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-sh5-3
    text: "跨片 join 消失——业务层聚合或宽表冗余"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-sh5-4
    text: "sharding 中间件（ShardingSphere/MyCat）对应用透明化路由"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
---

水平拆分带走的三个「单库福利」与补偿：

| 失去 | 补偿 |
|---|---|
| **自增主键** | **雪花算法**（本地生成趋势递增）/ Leaf 号段（DB 批量取） |
| **跨片事务** | **最终一致**（本地消息表/Saga）——强一致场景按分片键聚簇设计（同一用户的订单+明细同片，片内单库事务） |
| **跨片 join** | ①**字段冗余**（订单表冗余用户昵称——宽表化）；②业务层**内存聚合**（两次单点查询后代码 join）；③复杂查询走 **ES/数仓** |

**ShardingSphere** 这类中间件把路由/改写/归并对应用透明（SQL 照写，它翻译成各片查询）——但透明的是**单点路由和简单聚合**，复杂 join/事务仍要设计侧规避。

**术语速查**：聚簇设计=同用户数据同片｜冗余字段=以空间换 join｜透明路由=中间件翻译 SQL

<!--advanced-->
绑定表（binding table——两表同分片键同规则，片内 join 保留）。广播表（小字典表每片冗余一份免跨片）。分布式事务的强一致替代（同一分片键的数据物理同库——设计期解决比运行期补丁便宜）。
