---
id: 01M3NCQ6WZ83YT2YSABFFVPAST
blockId: mq/kafka-reliability
relatedBlocks: []
question: 刷盘策略和持久化的关系？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: mid
followUps:
  - 为什么 Kafka 不默认每条刷盘？
keyPoints:
  - id: kp-kr4-1
    text: 消息先写页缓存（OS）——log.flush.interval 默认交给 OS 择机刷盘
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr4-2
    text: 机器整体断电页缓存丢——多副本才是可靠性主轴
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr4-3
    text: 单副本+强制刷盘（flush.messages=1）吞吐暴跌
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr4-4
    text: 副本跨机架/可用区——物理故障域隔离
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr4-5
    text: 副本放置策略应跨故障域分布
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kr4-6
    text: 云盘自身的冗余层与 Kafka 副本互补
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
---

**写入 ≠ 落盘**：消息先入**页缓存**（内存），由 OS 择机批量刷盘（Kafka 默认不主动 fsync——顺序写+页缓存已经极快，**每条强刷吞吐暴跌**）。

于是「页缓存还没落盘就断电」的消息会丢吗？——**这正是多副本的意义**：单机磁盘数据可能丢，但**多副本同时挂的概率按副本数指数下降**；副本再**跨机架/可用区**，整机架断电也扛得住。**Kafka 的可靠性主轴是「副本冗余」而不是「单机刷盘」**——与 MySQL 的 redo 双 1 是两种取舍（DB 要单机先保证，MQ 靠集群保证）。

**术语速查**：页缓存=OS 的写缓冲｜副本冗余=多处同时存｜跨机架=物理故障域分开

<!--advanced-->
RocketMQ 对比：同步刷盘/异步刷盘显式可选（SYNC_FLUSH 极致单机可靠）。Kafka 的 flush.interval 调优只在特殊低副本场景。文件系统与 RAID/云盘的自身冗余层。
