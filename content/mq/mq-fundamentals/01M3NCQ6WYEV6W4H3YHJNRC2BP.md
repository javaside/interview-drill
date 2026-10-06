---
id: 01M3NCQ6WYEV6W4H3YHJNRC2BP
blockId: mq/mq-fundamentals
relatedBlocks: []
question: 点对点和发布订阅的区别？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: mid
followUps:
  - 一个服务多个实例怎么保证只处理一次？
keyPoints:
  - id: kp-mf2-1
    text: 点对点：一条消息只被一个消费者消费（抢食）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mf2-2
    text: 发布订阅：所有订阅者各得一份（广播）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mf2-3
    text: Kafka 以消费组实现两态：组内竞争（点对点）、组间广播
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mf2-4
    text: RabbitMQ 的 fanout/exchange 路由模型天然广播；queue 自身是点对点
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
---

两种**投递拓扑**：

- **点对点（P2P）**：消息**只有一个主人**——一个 Queue 一条消息被一个消费者拿走（多个消费者=竞争抢食）；
- **发布订阅（Pub/Sub）**：一条消息**所有订阅者各拿一份**（广播）。

**Kafka 的巧妙**：两者统一在「**消费组**」语义里——**组内**是点对点（一个 partition 只归组内一个消费者），**组间**是发布订阅（每组都拿到全量）。同一个服务多实例=同一消费组=消息不重复处理；新业务要看全量=新开一组。

**术语速查**：组内竞争=一条消息一个实例认领｜组间广播=每组全量一份

<!--advanced-->
RocketMQ 的广播模式（MessageModel.BROADCASTING）逐实例全量。RabbitMQ 的 exchange 类型（direct/fanout/topic）决定路由拓扑，queue 的独占/共享决定点对点与否。Kafka 消费组的 rebalance 见核心块。
