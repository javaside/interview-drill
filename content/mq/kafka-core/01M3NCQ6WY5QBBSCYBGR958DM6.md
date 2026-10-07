---
id: 01M3NCQ6WY5QBBSCYBGR958DM6
blockId: mq/kafka-core
relatedBlocks: []
question: Partition 和消费者组怎么配合？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 怎么减少 rebalance 的影响？
keyPoints:
  - id: kp-kc2-1
    text: 组内 rebalance：partition 重新分配给组内消费者
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY3KP3AJ5XMW57H238
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc2-2
    text: 触发：消费者增减/订阅变化/partition 扩容
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc2-3
    text: rebalance 期间整组 STOP THE WORLD——不能消费（长顿的元凶）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc2-4
    text: 消费者数 > partition 数则多余实例闲置——并行上限锁死在分区数
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY3KP3AJ5XMW57H238
      - 01M3NCQ6WY92YKR2DWS380WRQF
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc2-5
    text: 分配策略：Range/RoundRobin/Sticky/CooperativeSticky（增量再平衡）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
---

**消费组是动态的**：有人加入（扩容上线）、有人退出（宕机/被运维杀）——partition 的**归属要重新分**，这就是 **rebalance**。

两个要命的点：

1. **STW**：rebalance 协调期间**整组停止消费**（所有 partition 让出重分）——线上「消费每隔几分钟顿 1 分钟」多半是频繁 rebalance；
2. **并行上限**：同组消费者数 > partition 数 → **多余的闲着**（10 分区最多 10 个消费者并行）。

**减损三板斧**：①`session.timeout`/`heartbeat` 调稳（GC 停顿别误判死亡）；②用 **CooperativeSticky**（增量 rebalance——只挪受影响的 partition，不再全组停摆）；③消费逻辑**idempotent**（rebalance 后可能重复消费未提交部分）。

**术语速查**：rebalance=重新分地｜STW=分地期间全员停工｜增量再平衡=只动必要的地

<!--advanced-->
GroupCoordinator 与 ConsumerCoordinator 的 JoinGroup/SyncGroup 协议（消费者 leader 执行分配方案）。静态成员（group.instance.id）免惊群。offset 提交时机（处理完手动提交）与重复消费窗口。
