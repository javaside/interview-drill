---
id: 01M3NCQ6WZXTHNX5KY4QWP4CQS
blockId: mq/mq-problems
relatedBlocks:
  []
question: "怎么实现延迟队列的效果？"
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 30 分钟订单超时取消选哪种？
keyPoints:
  - id: kp-mp3-1
    text: "RocketMQ 延迟消息（4.x 固定档 / 5.x 任意时长）"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mp3-2
    text: "Kafka：按延迟档建延迟 topic + 定时搬运（到点转投目标 topic）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mp3-3
    text: "Redis ZSet（score=到期时间戳）+ 定时扫描投递"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mp3-4
    text: "时间轮：海量定时器的 O(1) 方案（Netty/内建）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mp3-5
    text: "超时取消必须与状态机 CAS 配合防并发踩踏"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'

---

四条路线按场景选：

| 方案 | 适用 | 特点 |
|---|---|---|
| **RocketMQ 延迟消息** | 已用 RMQ | 开箱即用（4.x 档位/5.x 任意） |
| **Kafka 延迟 topic** | 已用 Kafka | 自建：按档位（1m/5m/30m）建 topic，定时服务到点搬到目标 topic |
| **Redis ZSet** | 无 MQ 依赖轻量 | score=到期时间，轮询 zrangebyscore 投递（注意大量同刻到期的惊群） |
| **时间轮** | 海量定时任务 | O(1) 插入到期（Netty HashedWheelTimer / Kafka 内部同款） |

**30 分钟订单超时**：有 RMQ 直接延迟消息；Kafka 系就「延迟 topic+搬运」；量小（日千级）Redis ZSet 甚至 DB 扫表都够——**先看量级再选兵器**。

**术语速查**：延迟档=分级中转站｜ZSet=按分数（时间）排的集合｜时间轮=海量定时器 O(1)

<!--advanced-->
超时取消的idempotent（到期时用户刚支付——CAS 状态机）。延迟精度与扫描间隔的取舍。分层时间轮（轮次套轮次覆盖长延迟）。
