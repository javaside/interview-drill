---
id: 01M3NE18CMMRV6H6CDEV5EB4PR
blockId: distributed/consensus
relatedBlocks: []
question: 强一致性和最终一致性的取舍？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 为什么多数业务选最终一致？
keyPoints:
  - id: kp-cs3-1
    text: 强一致（线性一致）：读到的永远是最新写——代价是延迟与可用性
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-cs3-2
    text: 最终一致：停止写入后有限时间收敛一致——AP 路线
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-cs3-3
    text: 账户/库存选强一致；浏览量/点赞选最终一致
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-cs3-4
    text: Quorum 可调一致性：W+R>N 则强、否则弱
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

一致性不是「强就好」——它是**延迟和可用性的价格牌**：

- **强一致（线性一致）**：任何读都看到最新写——分布式下每次写要**同步等过半副本**确认（CP），分区时**宁可拒绝服务**。用在**错了就是钱**的地方：账户余额、库存扣减、分布式锁；
- **最终一致**：各副本异步追赶，**停写后有限时间收敛**——分区时各自服务（AP）。用在**错一点无妨**的地方：浏览量、点赞数、粉丝列表、商品推荐。

**可调中档（Quorum）**：W 写成功需确认数 + R 读成功需响应数，**W+R > N 即强一致**（写多读少 W=全R=1；读多写少 W=1 R=全）——Dynamo/Cassandra 的旋钮。

**术语速查**：线性一致=读到最新写的绝对保证｜收敛=最终都一致｜Quorum=读写确认数自己配

<!--advanced-->
一致性光谱（线性→顺序→因果→会话→最终）。读己之写（read-your-writes）的会话一致与粘性路由。spanner 的 TrueTime（物理时钟+不确定区间的外部一致）是强一致的另一条贵路。
