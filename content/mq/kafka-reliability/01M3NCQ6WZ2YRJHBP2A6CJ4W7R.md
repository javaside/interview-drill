---
id: 01M3NCQ6WZ2YRJHBP2A6CJ4W7R
blockId: mq/kafka-reliability
relatedBlocks: []
question: 怎么实现精确一次（Exactly-Once）？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - idempotent 生产者的局限是什么？
keyPoints:
  - id: kp-kr3-1
    text: idempotent 生产者：PID 与序号防重防乱序（限单分区单会话）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr3-2
    text: 事务：跨分区原子写+消费-处理-生产闭环（read-process-write）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr3-3
    text: 事务协调者两阶段提交，offset 与消息原子提交
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr3-4
    text: 端到端精确一次即idempotent 生产、事务、read_committed 三合一
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr3-5
    text: 更普遍的工程答案：at-least-once 配消费端防重（唯一键/状态机）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr3-6
    text: transactional.id 跨会话复用防僵尸生产者
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
---

Kafka 原生的三层方案：

1. **idempotent 生产者**：每生产者发号（PID+序号），broker 见过该序号的消息直接拒——**重试不重不乱**。局限：**单分区、单会话**（重启 PID 变了、跨分区不保）；
2. **事务**：`beginTransaction` → 多分区写 + 消费 offset 一并提交 → `commit`（协调者两阶段，abort 则全不可见）——把「**读 A→处理→写 B**」的闭环做成原子；
3. **read_committed**：消费端只读已提交消息（配合上面的闭环）。

**工程现实的答案**：多数业务不追 Kafka 内建 EOS——**at-least-once + 消费端idempotent**（唯一键插库/Redis setnx/状态机）实现**业务级精确一次**，更简单可控。

**术语速查**：idempotent=重发不重｜事务=多写原子｜业务idempotent=结果层面去重

<!--advanced-->
transactional.id 跨会话复用（防僵尸生产者）。Coordinator 的 __transaction_state 与两阶段。Streams 的 exactly_once_v2（2.5+ 性能改善）。idempotent键设计的业务唯一性（订单号+事件类型）。
