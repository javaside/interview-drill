---
id: 01M3NCQ6WZNW1B22CKKBTJG3DB
blockId: mq/kafka-reliability
relatedBlocks:
  []
question: "acks 参数的三个取值意味着什么？"
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 为什么 all 还要配 min.insync.replicas？
keyPoints:
  - id: kp-kr1-1
    text: "acks=0：发出即算成功——不候任何确认（可丢场景最快）"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-kr1-2
    text: "acks=1：Leader 写入即确认——Leader 挂且未同步完则丢"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-kr1-3
    text: "acks=all：ISR 全部副本写入才确认——最可靠（配 min.insync.replicas）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-kr1-4
    text: "acks=all 且 ISR 收缩到 1 时退化——min.insync.replicas=2 卡住底线"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-kr1-5
    text: "unclean 选举开关决定可用性与一致性的取舍"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-kr1-6
    text: "delivery.timeout 约束生产端整体重试时长"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
---

**acks=生产端要求 broker 写到什么程度才算「收到」**：

- **0**：fire-and-forget——网络里丢了都不知道（日志采集可容忍场景）；
- **1**：Leader 落盘就回 ack——Leader 刚 ack 就挂、Follower 还没同步完 → **丢**；
- **all/-1**：**ISR 里的副本全部写入**才 ack——但注意「ISR」是**动态**的：副本全故障时 ISR 可能只剩 Leader 一个，all 就退化成了 1——所以必须配 **`min.insync.replicas=2`**：ISR 少于 2 就**拒绝写入**（NotEnoughReplicas）——宁可不可用也不静默丢数据。

**术语速查**：ISR=跟得上的副本集合｜底线=至少几个同步副本才许写

<!--advanced-->
unclean.leader.election（非 ISR 副本能否当选——数据丢失换可用性的开关，金融场景禁）。acks 与 retries/delivery.timeout 的组合语义。broker 端 replica.lag 逻辑（0.9 时间阈值→2.x 条数/时间窗）。
