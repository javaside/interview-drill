---
id: 01M3NCQ6WY2CTX8NJDDE1MVHQ1
blockId: mq/mq-fundamentals
relatedBlocks:
  []
question: "推模式和拉模式的区别？"
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: mid
followUps:
  - 为什么 Kafka 坚持拉？
keyPoints:
  - id: kp-mf3-1
    text: "推：broker 主动推给消费者——低延迟但易压垮慢消费者"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mf3-2
    text: "拉：消费者按能力拉取——自然背压、跟不上就攒着"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mf3-3
    text: "Kafka 纯拉：消费端 poll 控制节奏；空轮询问题由长轮询缓解"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-mf3-4
    text: "RocketMQ 推模式本质是长轮询的封装（伪推）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
---

- **推（Push）**：broker 主动塞给消费者——**延迟最低**，但消费者的**处理能力被无视**：慢消费者被越塞越多（积压在它自己内存里炸掉）；
- **拉（Pull）**：消费者说「我好了，给我下一条」——**天然的背压**（处理多快拉多快），跟不上消息就**安全地攒在 broker**。

**Kafka 选纯拉**：消费者 `poll()` 控制节奏、按能力批量拉。拉的缺陷（没消息时空转）用**长轮询**解决（poll 带超时，broker 没数据就候着，有数据立刻返）。RocketMQ 的「推」其实也是**长轮询拉**的封装。

**术语速查**：背压=下游快不快决定上游给不给｜长轮询=候着但不空转

<!--advanced-->
Kafka 的 fetch.min/max.bytes 与 fetch.max.wait 的批量化旋钮。推模式的流控（RabbitMQ 的 prefetch=qos 就是给推装上背压阀）。Pulsar 的共享订阅游标即推拉混合。
