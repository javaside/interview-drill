---
id: 01M3NCQ6WZGHHN4S9QKFHPV38M
blockId: mq/rocketmq
relatedBlocks:
  - mq/mq-fundamentals
question: 延迟消息怎么实现？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 为什么不用定时任务扫全表？
keyPoints:
  - id: kp-rq2-1
    text: RocketMQ 4.x：18 个固定级别的延迟队列（SCHEDULE_TOPIC_XXXX 中转）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZXTHNX5KY4QWP4CQS
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-rq2-2
    text: 5.x 支持任意时间：timer wheel 定时轮
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZXTHNX5KY4QWP4CQS
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-rq2-3
    text: Kafka 无内建延迟——业务自建：延迟库+定时扫描、或时间轮轮次推进
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZXTHNX5KY4QWP4CQS
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-rq2-4
    text: 经典用法：订单超时未支付自动取消（延迟 30 分钟）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WX3PGTA0MFVSB8WBYN
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
---

**延迟消息 = 到点才投递的消息**（订单 30 分钟未付自动取消是标配场景）：

- **RocketMQ 4.x**：只支持 **18 个固定档**（1s/5s/10s/30s/1m…2h）——消息先写进内部延迟 topic（按档位分队列），**定时服务到点搬运**到真实 topic（5.x 起支持任意时长——时间轮）；
- **Kafka 没有内建**——方案：①延迟 topic + 分层时间轮自建；②Redis ZSet/时间轮到点投递；③**为什么不扫表**：定时任务扫「超时未支付」全表——数据量上去后（百万订单）扫一次几秒、扫描间隔内的精度误差大、DB 压力大——**MQ 的延迟是 O(1) 定点触发**，扫表是 O(N) 轮询。

**术语速查**：档位延迟=固定 18 档｜时间轮=任意延迟的定时器结构｜扫表=轮询全库的笨办法

<!--advanced-->
时间轮（hashed wheel）的 O(1) 插入/到期；Netty/Kafka 内部同款。延迟精度与吞吐的取舍（轮询 tick 粒度）。订单取消的idempotent（取消时可能已支付——状态机 CAS）。
