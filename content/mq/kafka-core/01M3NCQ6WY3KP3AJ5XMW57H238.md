---
id: 01M3NCQ6WY3KP3AJ5XMW57H238
blockId: mq/kafka-core
relatedBlocks: []
question: Kafka 的整体架构？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 为什么读写都走 Leader？
keyPoints:
  - id: kp-kc1-1
    text: Broker 集群 + ZooKeeper/KRaft 元数据 + 生产/消费客户端
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc1-2
    text: Topic 逻辑分类 → Partition 物理分片（有序队列，分散在 Broker）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY7KZGFE6X0HZ0K9KC
      - 01M3NCQ6WZ2NN8RWDEQY5XT6X8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc1-3
    text: 每 partition 多副本：1 Leader + N Follower，读写都走 Leader
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc1-4
    text: 消费者组：组内分摊 partition，组间互不影响
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WX3PGTA0MFVSB8WBYN
      - 01M3NCQ6WY5QBBSCYBGR958DM6
      - 01M3NCQ6WY7KZGFE6X0HZ0K9KC
      - 01M3NCQ6WYEV6W4H3YHJNRC2BP
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
misconceptions:
  - id: mc-kc1-1
    text: "Kafka 3.x 生产环境仍必须部署 ZooKeeper，KRaft 只是实验特性"
    why: "误解：KRaft 自 3.3 起生产可用，ZooKeeper 已进入弃用周期，新集群可以直接用 KRaft 自治，不再依赖外部协调系统"
  - id: mc-kc1-2
    text: "Follower 副本平时也对外提供读服务，可以分担 Leader 的消费压力"
    why: "误解：Kafka 的消费请求也只发往 Leader，Follower 唯一职责是拉取同步，读扩展靠加分区而不是靠 Follower"
  - id: mc-kc1-3
    text: "一个 partition 可以同时分给同组的多个消费者，broker 会把消息轮流派发"
    why: "误解：同组内一个 partition 只归一个消费者独占，轮流派发会破坏分区内顺序，组内并行上限就是分区数"
---

**Kafka 的四层积木**：

- **Broker**：服务节点（一个集群 N 台）——元数据由 ZooKeeper（旧）或 **KRaft**（新，2.8+ 自治）协调；
- **Topic → Partition**：Topic 是**逻辑频道**，切成 **Partition**（物理上的有序队列）分散到各 Broker——**并行度的基本单位**（一个 topic 的吞吐 = 各 partition 之和）；
- **副本（Replica）**：每 partition 有多副本（1 Leader + N Follower）——**读写都只走 Leader**（Follower 只同步）：简单（客户端不用管副本拓扑）+ 顺序保证（单点写入才有全局有序）+ 顺序读磁盘快；
- **消费者组**：组内瓜分 partition（一个 partition 同组只归一人），组间广播。

**术语速查**：Partition=并行与顺序的边界｜Leader=partition 的唯一读写口｜KRaft=去 ZooKeeper 的自治

<!--advanced-->
KRaft 的 Raft 元数据日志替代 ZK（3.x 默认）。副本的角色与 ISR 机制见可靠性块。分区 Leader 选举由 controller 触发。批量与压缩贯穿生产→存储→消费（端到端 batch）。
