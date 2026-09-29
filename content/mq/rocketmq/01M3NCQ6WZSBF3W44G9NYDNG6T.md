---
id: 01M3NCQ6WZSBF3W44G9NYDNG6T
blockId: mq/rocketmq
relatedBlocks:
  - mq/mq-fundamentals
question: "死信队列的触发条件和用途？"
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 死信和重试队列的关系？
keyPoints:
  - id: kp-rq3-1
    text: "触发：重试耗尽（RocketMQ 默认 16 次）消息进 %DLQ%消费组"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-rq3-2
    text: "用途：隔离毒消息保消费组前进 + 人工介入/修复后重放"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-rq3-3
    text: "Kafka 无内建 DLQ——Spring Kafka 处理失败可发往自定义死信 topic"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-rq3-4
    text: "死信要监控告警：死信堆积=业务异常面"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
---

**死信队列（DLQ）= 毒消息的隔离区**：

流程：消费失败 → **重试队列**按退避节奏再投（RocketMQ 默认 16 次重试）→ 仍失败 → 投入**死信 topic**（`%DLQ%消费组名`）——消费组**继续正常前进**（不被一条坏消息卡死全队列）。

**用途**：①保主流程通畅（坏消息别拖垮百万正常消息）；②**人工/程序介入**——修好 bug 后把死信**重放**回原 topic；③死信堆积量是重要的**业务健康指标**（schema 变更/脏数据爆发的第一现场）。

**Kafka 无内建**：Spring Kafka 的 DefaultErrorHandler 自动发往死信 topic（含失败原因 header）。

**术语速查**：毒消息=处理永远失败的消息｜隔离区=DLQ｜重放=修好后重新投递

<!--advanced-->
死信的 TTL（默认 3 天 RocketMQ，超时删除——重要死信要外移归档）。重试次数与业务时效的匹配（超时未处理=业务已无意义，直接降级）。DLQ 的消费权限（建议只读+告警）。
