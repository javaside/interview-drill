---
id: 01M3NCQ6WY7KZGFE6X0HZ0K9KC
blockId: mq/kafka-core
relatedBlocks: []
question: 怎么保证同一 key 的消息顺序？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 订单的创建和取消乱序了会怎样？
keyPoints:
  - id: kp-kc3-1
    text: Kafka 只保证 partition 内有序——全局有序需单 partition
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WX3PGTA0MFVSB8WBYN
      - 01M3NCQ6WY3KP3AJ5XMW57H238
      - 01M3NCQ6WZTXVFFZ8CA7GTX61J
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc3-2
    text: 同 key 哈希到同一 partition（默认分区器）——key 级有序
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WX3PGTA0MFVSB8WBYN
      - 01M3NCQ6WY3KP3AJ5XMW57H238
      - 01M3NCQ6WZTXVFFZ8CA7GTX61J
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc3-3
    text: 重试与 in.flight>1 组合可能乱序——idempotent 生产者防住
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZ2YRJHBP2A6CJ4W7R
      - 01M3NCQ6WZTXVFFZ8CA7GTX61J
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc3-4
    text: 扩分区会改变 key 的落点——顺序敏感的 topic 提前规划够多分区
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY92YKR2DWS380WRQF
      - 01M3NCQ6WZTXVFFZ8CA7GTX61J
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
---

**顺序的粒度**：Kafka 只保证 **partition 内有序**（单队列天然先进先出）。跨 partition 无全局序。

**实践口径：key 级有序**——生产时指定 key（如订单号）：**同 key 必落同一 partition**（哈希路由）→ 同一订单的所有消息严格按发送序排列。不同订单（key）之间无序——但业务本来也不需要。

两个暗坑：①**重试乱序**——批次 1 失败重发时批次 2 已写入（`max.in.flight>1`）——开**idempotent 生产者**（broker 会按序号拒掉重复/重排）；②**扩分区**——key 哈希空间变了，同 key 新旧消息可能分家——顺序敏感 topic **一开始就规划足量分区**。

**术语速查**：partition 内序=单队列 FIFO｜key 路由=同订单同队列｜idempotent 生产=重试不乱序

<!--advanced-->
全局有序的代价（单分区=并行度 1，吞吐坍缩）。消费端多线程破坏顺序：partition 内取到消息再乱序丢线程池——需按 key 二次哈希到固定线程/内存队列。事务（多 partition 原子写）与顺序的正交性。
