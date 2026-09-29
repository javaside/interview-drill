---
id: 01M3NCQ6WZXWCFN4X31050P95T
blockId: mq/rocketmq
relatedBlocks:
  - mq/mq-fundamentals
question: "RocketMQ 的事务消息怎么工作？"
cardType: sequence
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 回查失败了怎么办？
keyPoints:
  - id: kp-rq1-1
    text: "第 1 步 发送半消息（half message）：对消费者不可见"
    public: true
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-rq1-2
    text: "第 2 步 执行本地事务（比如订单落库）"
    public: true
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-rq1-3
    text: "第 3 步 提交或回滚半消息（commit 则消息可见）"
    public: true
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
  - id: kp-rq1-4
    text: "第 4 步 回查兜底：broker 未收到二次确认时反查生产者的本地事务状态"
    public: true
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
---

**事务消息**解决「**本地事务与发消息的原子性**」（要么都成、要么都不生效）：

```
①半消息（对消费者不可见的「草稿」）
②执行本地事务（订单入库）
③按事务结果 commit（消息转正可消费）或 rollback（删除半消息）
④兜底回查：broker 迟迟没等到二次确认 → 反查生产者「你那个本地事务到底成没成？」
```

**回查的实现**：生产者实现 `checkLocalTransaction`（通常查**本地事务的落库结果**——订单存在即 commit）。回查也失败（生产者一直没响应）→ broker 按默认策略**丢弃或重试 N 次后丢弃**（rocketmq.transaction.timeout）——**最终一致的兜底**是业务对账，不是无限重试。

**术语速查**：半消息=暂不可见的草稿｜回查=broker 反问事务结果｜对账=最终兜底

<!--advanced-->
对比本地消息表：事务消息把「记录+补偿」内建到 broker（省一张表+扫描任务），本地消息表更通用（不绑 MQ）。消费端仍是 at-least-once（事务消息只保生产侧原子）。Kafka 事务与 RocketMQ 事务消息的目标差异（多分区原子 vs 本地事务联动）。
