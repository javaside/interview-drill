---
id: 01M3NCQ6WZM77BRZ9HA40YFD6A
blockId: mq/rocketmq
relatedBlocks:
  - mq/mq-fundamentals
question: "RabbitMQ 的 exchange 模型？"
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: mid
followUps:
  - 和 Kafka 的模型差异在哪？
keyPoints:
  - id: kp-rq4-1
    text: "生产者只发 exchange，exchange 按类型路由到 queue"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-rq4-2
    text: "direct：binding key 精确匹配；topic：通配符匹配（order.*）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-rq4-3
    text: "fanout：广播到所有绑定队列；headers：按头字段匹配"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-rq4-4
    text: "queue 持久化+消息持久化才保不丢（两开关都要开）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
---

**RabbitMQ 的路由中枢是 exchange（交换机）**：生产者不直接发队列——消息进 exchange，由 **binding 规则**路由到一/多/零个 queue：

| 类型 | 规则 | 像什么 |
|---|---|---|
| **direct** | key 精确匹配 | 一对一投递 |
| **topic** | 通配符（`order.*`/`#.pay`） | 订阅感兴趣的主题 |
| **fanout** | 无条件广播 | 全员群发 |
| **headers** | 按消息头匹配 | 少用 |

**与 Kafka 的本质差异**：Rabbit 是**智能路由+队列缓冲**（低延迟、灵活拓扑、万级吞吐）；Kafka 是**日志流**（分区顺序、百万级吞吐、重放）。选型口径：业务消息路由复杂/需要请求回复选 Rabbit；高吞吐流/回溯重放选 Kafka。

**术语速查**：exchange=路由器｜binding=路由表｜持久化两开关=queue+消息都要

<!--advanced>>
confirm 机制（生产确认）与 mandatory/alternate exchange（不可路由兜底）。prefetch 的流控（推模式的背压阀）。镜像队列/quorum queue 的高可用形态。
