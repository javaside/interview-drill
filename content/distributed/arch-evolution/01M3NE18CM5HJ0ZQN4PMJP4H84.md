---
id: 01M3NE18CM5HJ0ZQN4PMJP4H84
blockId: distributed/arch-evolution
relatedBlocks:
  []
question: "中大型系统的典型分层？"
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - 为什么应用层要无状态？
keyPoints:
  - id: kp-ae2-1
    text: "接入层：DNS/GSLB→CDN→LB（L4/L7）→网关"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ae2-2q
    text: "应用层：无状态服务（聚合/编排）——横向扩展"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ae2-3
    text: "数据层：缓存（本地+分布式）→ DB（主从/分片）+ 异构存储（ES/数仓）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ae2-4
    text: "支撑：注册配置中心/MQ/链路监控——横切全栈"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
---

典型互联网后端的**纵向分层**（请求路径从上到下）：

```
DNS/GSLB（就近接入）→ CDN（静态/边缘缓存）→ LB（四层负载）→ 网关（鉴权/限流/路由）
  → 应用服务层（无状态业务逻辑）→ 缓存（Redis/本地）→ 数据库（主从/分库分表）
  异构：MQ 异步解耦 / ES 查询 / 数仓分析
```

**应用层无状态**是横向扩展的前提：**会话/数据全外置**（session 进 Redis、文件进对象存储）——任何实例**完全等价**，挂了直接换、扩容直接加（LB 随机分发无粘滞）。有状态=扩展的镣铐（要么粘性路由、要么状态复制）。

**术语速查**：无状态=实例完全等价｜外置状态=会话进 Redis 文件进 OSS｜等价=挂谁加谁都一样

<!--advanced-->
每一层的容量水位与连锁故障路径（缓存击穿→DB→应用线程池→入口雪崩的传播链）。读写分离的 CQRS 形态。多机房层的容灾单元化路由。
