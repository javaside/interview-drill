---
id: 01M3NCQ6WZGNAPXSW2KZR44JMT
blockId: mq/kafka-reliability
relatedBlocks: []
question: ISR 是什么？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 和全部副本有什么区别？
keyPoints:
  - id: kp-kr2-1
    text: In-Sync Replicas：与 Leader 保持同步的副本集合（含 Leader）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY3KP3AJ5XMW57H238
      - 01M3NCQ6WZCBCQ402KD1EGFN27
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr2-2
    text: 落后超阈值的副本被踢出 ISR，追上再回来
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY3KP3AJ5XMW57H238
      - 01M3NCQ6WZCBCQ402KD1EGFN27
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr2-3
    text: Leader 选举只从 ISR 里挑——保证新 Leader 拥有全部已确认消息
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY3KP3AJ5XMW57H238
      - 01M3NCQ6WZ83YT2YSABFFVPAST
      - 01M3NCQ6WZCBCQ402KD1EGFN27
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr2-4
    text: acks=all 的「all」指的就是 ISR 里的全部成员
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY3KP3AJ5XMW57H238
      - 01M3NCQ6WZ83YT2YSABFFVPAST
      - 01M3NCQ6WZCBCQ402KD1EGFN27
      - 01M3NCQ6WZNW1B22CKKBTJG3DB
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr2-5
    text: HW 高水位限定消费者可见范围
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY3KP3AJ5XMW57H238
      - 01M3NCQ6WZCBCQ402KD1EGFN27
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr2-6
    text: LeaderEpoch 机制防副本截断不一致
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY3KP3AJ5XMW57H238
      - 01M3NCQ6WZCBCQ402KD1EGFN27
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
---

**分区副本分两拨**：

- **ISR（同步副本集）**：**跟得上** Leader 的（含 Leader 自己）——判据是落后时间/条数在阈值内；
- **OSR（落后副本）**：追不上的（GC 长停顿/网络差/刚上线）——**踢出** ISR，追上再拉回。

两个关键语义：①**Leader 只从 ISR 里选**——保证新 Leader 拥有全部**已 ack** 的消息（不丢的根基）；②**acks=all 写满 ISR** 即确认——所以 ISR 活多少人决定可靠与可用（配 min.insync.replicas 卡底线）。

**术语速查**：ISR=跟得上的队伍｜踢出=落后者出局｜从 ISR 选主=不丢已确认消息

<!--advanced-->
HW（High Watermark 高水位）：消费者只能读到 ISR 全部复制的部分；LEO（Log End Offset）各副本日志末端。LeaderEpoch 防截断不一致。KRaft 时代 controller 驱动副本状态机。
