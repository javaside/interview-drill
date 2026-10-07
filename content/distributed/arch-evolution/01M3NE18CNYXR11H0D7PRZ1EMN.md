---
id: 01M3NE18CNYXR11H0D7PRZ1EMN
blockId: distributed/arch-evolution
relatedBlocks: []
question: 怎么设计一个秒杀系统？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 为什么不直接打数据库？
keyPoints:
  - id: kp-ae4-1
    text: 漏斗逐层削流：CDN 静态→网关限流→队列削峰→DB 短事务
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CM79Q3MZ0JMWFRJ6FB
      - 01M3NE18CMDD5CJ936BEH04P60
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ae4-2
    text: 库存预热进 Redis：原子扣减（lua/DECR），DB 异步落账
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ae4-3
    text: MQ 排队下单：请求入队立即返回「排队中」，消费端匀速建单
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSFQ6DJYJ18QPFWZQBD
      - 01M3NE18CMDD5CJ936BEH04P60
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ae4-4
    text: 防刷：答题/验证码打散瞬时尖峰+限 uid 频次
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CMDD5CJ936BEH04P60
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ae5-5
    text: 兜底：库存扣到 0 即终态，超卖=红线（lua 原子+校验）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

**秒杀的本质：10 万 QPS 抢 100 件库存**——99.9% 的请求注定失败，**设计目标就是让它们死得越早越便宜**（漏斗逐层拦）：

```
静态化（商品页 CDN——介绍页根本不用到后端）
  → 防刷（验证码/答题：打散机器人尖峰 + uid 频次限）
  → 网关限流（随机丢/排队——放行的=略大于库存）
  → Redis 原子预扣（lua：查+扣一原子——扣到 0 后续全拒，DB 无感）
  → MQ 排队（通过的请求入队，页面转「排队中」轮询）
  → 消费端匀速建单（DB 短事务：扣真实库存+建单+支付窗）
```

**为什么不直接打 DB**：数据库每秒数千连接就是极限——10 万 QPS 进来**连接池秒空、全部请求超时**（连抢到的人也失败）。Redis 单机 10 万+ ops + lua 原子性是「**预扣库存**」的正确场地，DB 只见匀速流。

**术语速查**：漏斗=层层拦死得早｜预扣=Redis 里先扣，DB 后落账｜超卖红线=lua 查扣原子

<!--advanced-->
热点 key 的本地缓存+分段库存（stock 拆 10 份散节点防单热点）。轮询转长连接推送（排队结果）。对账与补偿（Redis 扣减数 vs DB 成单数核对）。
