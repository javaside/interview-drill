---
id: 01M3NE18CMWEQ7GZJVCYEBDWF4
blockId: distributed/dist-tx
relatedBlocks: []
question: 本地消息表 vs 事务消息怎么选？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 没有 RocketMQ 怎么办？
keyPoints:
  - id: kp-dt4-1
    text: 本地消息表：业务与消息同库同事务——强可靠，侵入 DB
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt4-2
    text: 事务消息：MQ 半消息+回查——不侵入业务库，绑 MQ 能力
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt4-3
    text: 两者目标相同：本地事务与消息发送的原子性
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt4-4
    text: 最终一致都依赖：消费端 idempotent 加失败重试加对账
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

「**DB 落库成功 = 消息一定发出去**」的两条实现：

- **本地消息表**：业务表与消息表**同库同事务**写入（要么都在要么都不在）→ 后台扫表投递 → 成功标记。优点：**不依赖任何 MQ 特性**（Kafka/Rabbit 都行）、链路完全自己掌控。代价：业务库多一张表 + 扫描任务；
- **事务消息**（RocketMQ）：半消息 → 本地事务 → 回查——把消息表搬进 broker，业务少张表，但**绑定 MQ**（Kafka 没有）。

**没有 RocketMQ**：本地消息表是不二之选（通用性满分）；量大后用 binlog 订阅（Canal）代替扫表。**两者殊途同归**：最终一致 = 生产原子 + at-least-once + **消费幂等** + 对账兜底。

**术语速查**：同库同事务=落库即留言｜扫表=定时捞未发｜半消息=MQ 版消息表

<!--advanced-->
最大努力通知（指数退避 N 次+人工查询对账接口）。对账的闭环设计（T+1 批核 + 实时差异告警）。outbox 模式即本地消息表的 DDD 名（CDC 方案 Debezium）。
