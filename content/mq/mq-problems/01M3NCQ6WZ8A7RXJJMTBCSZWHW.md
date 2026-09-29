---
id: 01M3NCQ6WZ8A7RXJJMTBCSZWHW
blockId: mq/mq-problems
relatedBlocks:
  []
question: "怎么保证消息的事务性（与本地事务联动）？"
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 本地消息表的扫表压力怎么解？
keyPoints:
  - id: kp-mp4-1
    text: "本地消息表：业务与消息记录同库同事务落盘，后台扫表投递"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mp4-2
    text: "RocketMQ 事务消息：半消息+回查（MQ 内建）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mp4-3
    text: "事务结果驱动投递：commit 后消息可见，rollback 则废弃"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mp4-4
    text: "下游消费端防重闭环——生产原子加消费端防重即端到端一致"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mp4-5
    text: "binlog 订阅可替代扫表驱动投递"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
---

「**下订单（DB）+ 发消息（MQ）**」要原子，两条路：

1. **本地消息表**（最通用）：订单与「待发消息」**同库同事务**写入 → 后台任务扫未发表投递 → 成功标记。**扫表压力解法**：①投递后**快速标记**（索引 on status）；②分片扫描/时间片轮转；③量更大用 binlog 订阅（Canal）代替扫表——**插入即事件**；
2. **RocketMQ 事务消息**：半消息+本地事务+回查（见 RocketMQ 块）——把消息表搬进 broker。

闭环公式：**生产原子（二选一）+ at-least-once + 消费端防重 = 端到端业务一致**。

**术语速查**：同库同事务=一起成功失败｜扫表=定时捞未发｜binlog 订阅=插入即事件

<!--advanced-->
本地消息表的状态机（INIT→SENT→CONFIRMED）与重投上限。最大努力通知的指数退避。跨库最终一致的对账兜底（T+1 核对脚本）。
