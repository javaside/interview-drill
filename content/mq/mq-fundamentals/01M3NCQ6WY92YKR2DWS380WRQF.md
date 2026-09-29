---
id: 01M3NCQ6WY92YKR2DWS380WRQF
blockId: mq/mq-fundamentals
relatedBlocks:
  []
question: "消息积压了怎么处理？"
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 消费者数量为什么不能超过 partition 数？
keyPoints:
  - id: kp-mf4-1
    text: "定位：消费速率 < 生产速率多久了——监控 lag（堆积量）"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mf4-2
    text: "临时扩容：加消费者实例（上限=partition 数），或升级消费端配置"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mf4-3
    text: "消费端优化：批量拉取/批量写库/异步 IO/去掉慢调用（RPC 挪出循环）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mf4-4
    text: "紧急泄洪：新消费者快速转储到新 topic（更多分区）再慢慢消化"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mf4-5
    text: "可丢场景：过期消息直接丢弃或落盘归档后跳过"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
---

**积压 = lag（生产领先消费的条数）**。处置四板斧：

1. **先量化**：lag 曲线是涨是稳？稳定=只是慢（优化消费），陡涨=生产暴增或消费挂了（先救活）；
2. **横向扩**：**加消费者实例**——但上限是 **partition 数**（Kafka 一个 partition 同组只归一个消费者，超出的实例白闲着）——真要突破就**扩分区+重平衡**（注意扩分区破坏同 key 顺序）；
3. **消费端提速**：批量拉（fetch.max.bytes）、批量写（攒一批 insert）、循环里的 RPC/慢 SQL 挪出去；
4. **紧急泄洪**：上**转储方案**——快速消费者把消息搬到分区更多的**新 topic**，再由大队人马慢慢消化；可丢业务（过期即废的告警）直接跳过/归档。

**术语速查**：lag=堆积深度的水位线｜消费者上限=partition 数｜转储=搬到更多分区再消化

<!--advanced-->
skipToEnd（跳到最新）的丢弃边界。分区扩容 key 顺序破坏（同 key 可能落到新分区）→ 顺序敏感业务须重建 topic 迁移。消费端限流保护下游。容量规划：分区数 ≥ 预期最大消费者数。
