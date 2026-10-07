---
id: 01M3NCQ6WY4PRW9YHEZSKMAWV5
blockId: mq/mq-fundamentals
relatedBlocks: []
question: 怎么设计一个消息的完整生命周期保障？
cardType: sequence
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 哪一环最容易丢消息？
keyPoints:
  - id: kp-mf5-1
    text: 第 1 环 生产端：发送确认（acks）+ 失败重试 + 本地消息表兜底
    public: true
    order: 1
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZ2YRJHBP2A6CJ4W7R
      - 01M3NCQ6WZ8A7RXJJMTBCSZWHW
      - 01M3NCQ6WZCBCQ402KD1EGFN27
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mf5-2
    text: 第 2 环 broker：多副本持久化（刷盘策略）+ 高可用集群
    public: true
    order: 2
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY3KP3AJ5XMW57H238
      - 01M3NCQ6WZ2YRJHBP2A6CJ4W7R
      - 01M3NCQ6WZ83YT2YSABFFVPAST
      - 01M3NCQ6WZCBCQ402KD1EGFN27
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mf5-3
    text: 第 3 环 消费端：手动 ack（处理成功才签收）与idempotent 去重
    public: true
    order: 3
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZ2YRJHBP2A6CJ4W7R
      - 01M3NCQ6WZ8A7RXJJMTBCSZWHW
      - 01M3NCQ6WZC00C1NKK1Y7X64MR
      - 01M3NCQ6WZC2R2ZYTTCM2YF3A5
      - 01M3NCQ6WZCBCQ402KD1EGFN27
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mf5-4
    text: 第 4 环 兜底：对账（生产表 vs 消费表）+ 死信人工介入
    public: true
    order: 4
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZ2YRJHBP2A6CJ4W7R
      - 01M3NCQ6WZ8A7RXJJMTBCSZWHW
      - 01M3NCQ6WZC00C1NKK1Y7X64MR
      - 01M3NCQ6WZSBF3W44G9NYDNG6T
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
---

「**不丢**」是三段接力，每段各自的保险（按链路顺序排）：

1. **生产端**：发送要**确认**（Kafka acks=all；失败重试 + idempotent 生产者）——最脆弱的一段（网络闪断静默失败），金融场景上**本地消息表**（先落库再异步发、失败重发）；
2. **broker**：**多副本**落盘（acks=all 意味着 ISR 全写完才确认）+ 副本跨机架；
3. **消费端**：**先处理再手动 ack**（自动 ack = 处理一半崩了消息就没了）；处理成功但 ack 前崩 → 重投 → **消费端防重**接住；
4. **兜底**：定时**对账**（生产流水 vs 消费流水，差额补发）+ 死信队列人工处理。

**最容易丢的两处**：生产端发送无确认（fire-and-forget）、消费端先 ack 后处理。

**术语速查**：确认=写入才算数｜手动 ack=干完活再签收｜对账=定期数账补差

<!--advanced-->
本地消息表与事务消息的两路线（RocketMQ 半消息 vs 本表轮询）。消费端防重的实现（唯一键/状态机/Redis setnx）。全链路消息 id 贯穿（traceId 关联）与告警水位。
