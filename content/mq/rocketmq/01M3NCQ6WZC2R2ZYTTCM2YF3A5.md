---
id: 01M3NCQ6WZC2R2ZYTTCM2YF3A5
blockId: mq/rocketmq
relatedBlocks:
  - mq/mq-fundamentals
question: "消息idempotent怎么实现？"
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 为什么不能靠 MQ 自己不重复？
keyPoints:
  - id: kp-rq5-1
    text: "唯一键约束：业务号（订单号+事件类型）插库天然去重"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-rq5-2
    text: "状态机：只允许合法迁移（已支付收到取消前的扣款消息→跳过）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-rq5-3
    text: "Redis setnx/SETNX+过期时间挡住短窗口重复"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-rq5-4
    text: "版本号/乐观锁：带版本更新，重复消息第二次影响为零"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-rq5-5
    text: "选择标准：强一致用库唯一键；高频用 Redis；流程类用状态机"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
---

**重复投递是 MQ 的本性**（网络重试/重平衡/ack 丢失都可能重投）——**at-least-once 是底色**，与其对抗不如接受 + **消费端防重**：

四板斧按强度选：

1. **唯一键**（最强，推荐首选）：`uk(订单号, 事件类型)` 插库——第二次 insert 直接被数据库拒——**存储层兜底**；
2. **状态机**：订单已「PAID」，再收到「支付成功」→ idempotent跳过——业务语义天然防重；
3. **Redis setnx**：处理前 `setnx(msgId, 1, ex)`——挡住短窗口重复（Redis 挂了/过期边界有风险——辅助件不是保命件）；
4. **乐观锁**：`update ... where version=v`——重复消息第二次影响 0 行。

**为什么必须消费端做**：MQ 只能尽量少重（Kafka 事务/idempotent 生产者管生产侧），**消费重投**跨重启/重平衡无法根除——唯一键落库是最终防线。

**术语速查**：唯一键=库层去重｜状态机=业务语义去重｜setnx=短窗口闸门

<!--advanced-->
idempotent键设计（业务唯一标识 vs msgId——broker 的 msgId 可能因重发而不同）。批量消费的idempotent（部分成功的处理）。事务里「插idempotent表+业务表」同库同事务的原子里程碑。
