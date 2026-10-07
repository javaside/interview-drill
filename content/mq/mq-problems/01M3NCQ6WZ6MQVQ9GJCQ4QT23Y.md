---
id: 01M3NCQ6WZ6MQVQ9GJCQ4QT23Y
blockId: mq/mq-problems
relatedBlocks: []
question: 怎么设计一个消费框架的监控体系？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: mid
followUps:
  - lag 告警阈值怎么设？
keyPoints:
  - id: kp-mp5-1
    text: 核心指标：lag（堆积）、消费延迟、失败率、死信量
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY92YKR2DWS380WRQF
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mp5-2
    text: lag 持续上涨=消费力不足；lag 突跳=生产暴增或消费挂
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY92YKR2DWS380WRQF
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mp5-3
    text: 处理耗时分布（P99）暴露慢消费（RPC/慢 SQL）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY92YKR2DWS380WRQF
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mp5-4
    text: 死信告警=业务异常面；端到端对账=丢失终极防线
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZCBCQ402KD1EGFN27
      - 01M3NCQ6WZSBF3W44G9NYDNG6T
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mp5-5
    text: rebalance 频次是消费组健康的隐性指标
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY92YKR2DWS380WRQF
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mp5-7
    text: rebalance 频次是消费组健康的隐性指标
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY92YKR2DWS380WRQF
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
---

**MQ 监控的四类仪表**：

1. **lag（堆积水位）**——核心中的核心：**持续上涨**=消费能力不足（扩容/优化）；**突跳**=生产暴增（正常活动）或消费者挂了（看心跳）；阈值按业务时效定（支付类超 1 分钟就该响）；
2. **消费延迟**（消息时间戳与当前差）——比 lag 更贴近业务体感；
3. **失败率与重试量**——处理异常的趋势（伴随死信量告警）；
4. **处理耗时 P99**——慢消费定位（循环里的 RPC/大事务）。

**终极防线**：端到端对账（生产表 vs 消费表按 ID 比对）——监控抓不到的静默丢失由它兜底。

**术语速查**：lag=堆积水位｜消费延迟=业务体感时间差｜对账=丢失的兜底审计

<!--advanced-->
kafka_exporter/Burrow 的 lag 评估（绝对值+增速双维度）。Prometheus 的 recording rules 预聚合。消费组行为监控（rebalance 频次——频繁 rebalance 是隐形杀手）。
