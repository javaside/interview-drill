---
id: 01M3NCQ6WX3PGTA0MFVSB8WBYN
blockId: mq/mq-fundamentals
relatedBlocks: []
question: 为什么要用消息队列？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 削峰填谷的代价是什么？
keyPoints:
  - id: kp-mf1-1
    text: 解耦：上下游互不依赖，新增消费方零改动
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mf1-2
    text: 异步：非核心链路（通知/积分）异步化，响应时间从串行和降为最长一步
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mf1-3
    text: 削峰：洪峰先进队列排队，消费端按自己的节奏消化
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mf1-4
    text: 代价：系统复杂度上升——可用性依赖、一致性变最终、重复消息治理
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
---

三大收益（也是三大经典答案）：

1. **解耦**：订单服务发一条「订单已建」，库存/积分/通知各自订阅——**上游不关心谁在消费**，加一个消费方上游零改动；
2. **异步**：下单主链路只做核心三步，发通知/记积分扔给 MQ——**响应时间从「串行总和」变成「最长一步」**；
3. **削峰**：秒杀 10 万 QPS 打进来，**队列当蓄水池**——消费端按数据库扛得住的 2 千 QPS 慢慢喝。

**代价（面试说出这个才加分）**：①可用性多米诺——MQ 挂全链路瘫（要求 MQ 高可用）；②**一致性退化为最终一致**（下游晚到几分钟才处理完）；③**重复消息/乱序**必须治理（见难题块）。

**术语速查**：解耦=互不认识靠中间人｜削峰=洪峰排队慢慢喝｜最终一致=晚点但会到

<!--advanced-->
选型经：吞吐/顺序/事务消息/生态。Kafka（日志流/吞吐王）、RocketMQ（业务消息/事务/延迟）、RabbitMQ（路由灵活/低延迟）。削峰的另一面：队列是无限长的吗（磁盘水位/丢弃策略/TTL 淘汰）。
