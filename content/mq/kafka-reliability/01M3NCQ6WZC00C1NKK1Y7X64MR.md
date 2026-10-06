---
id: 01M3NCQ6WZC00C1NKK1Y7X64MR
blockId: mq/kafka-reliability
relatedBlocks: []
question: 消费者怎么处理消息才算安全？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 重试几次合适？
keyPoints:
  - id: kp-kr5-1
    text: 先处理业务、成功后手动提交 offset（at-least-once）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr5-2
    text: 业务idempotent：唯一键/状态机/Redis 去重拦住重投
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr5-3
    text: 处理失败：重试有限次后进死信（retry topic / DLQ）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr5-4
    text: 禁止：先提交后处理（丢消息）、异常静默吞掉（假成功）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr5-5
    text: DefaultErrorHandler 的退避策略可编程配置
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
---

消费侧的**安全公式 = 手动提交 + idempotent + 死信出口**：

1. **先干活再签收**：业务处理成功 → `commitSync`；失败不提交 → 重启/重平衡后**重投**（at-least-once）；
2. **idempotent接重投**：重投=可能重复——唯一键（订单号插库唯一索引）/状态机（已支付跳过）/Redis setnx，任选实现「再来一次没副作用」；
3. **死信出口**：失败别无限重——重试 N 次（如 3 次，间隔退避）仍败 → 转入**死信 topic**（人工/告警处理）——**消费组继续前进不被一条毒消息卡死**。

**两大禁令**：先提交后处理（崩了=丢）；catch 里吞异常继续提交（假成功=丢得更隐蔽）。

**术语速查**：手动提交=干完活签收｜毒消息=怎么处理都失败的消息｜死信=隔离区人工处理

<!--advanced-->
Spring Kafka 的 AckMode（MANUAL/MANUAL_IMMEDIATE）与 DefaultErrorHandler 的退避（ExponentialBackOff）。DLQ 的语义（含失败上下文 header）。毒消息的常见源：schema 演进/脏数据/下游持续 500。
