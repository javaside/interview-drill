---
id: 01M3NCQ6WYSMTEEETJJ2XH9FBX
blockId: mq/kafka-core
relatedBlocks: []
question: offset 是什么？怎么提交？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 自动提交为什么会丢消息？
keyPoints:
  - id: kp-kc4-1
    text: offset=消息在 partition 里的位点号（单调递增）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc4-2
    text: 消费进度=已提交 offset；重启从提交位点继续
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc4-3
    text: 自动提交（enable.auto.commit）定时交——可能重复（处理完没交就崩）或丢（交了没处理就崩）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc4-4
    text: 手动提交：处理成功后 commitSync/commitAsync——精确但慢一点
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc4-5
    text: offset 存在内部 topic __consumer_offsets（不是 ZK，0.9+）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
---

**offset = partition 内的座位号**（0,1,2,…）。消费组记住「我读到几号了」——**重启从这儿接着读**。

**提交时机=重复与丢失的天平**：

- **自动提交**（每 5 秒交一次已 poll 的最大位）：**崩在错误时刻两头挨打**——处理完还没到提交点就崩 → 重启**重复**消费；反过来「先提交后处理」窗口崩 → 消息**丢**（位已交，活没干）；
- **手动提交**（处理完再 commit）：**at-least-once**——最坏重复（处理完、提交前崩），配合**消费端防重**即实际精确一次。

**术语速查**：位点=读到几号｜提交=汇报进度｜先处理后提交=宁可重复不可丢

<!--advanced-->
__consumer_offsets 的 compact 存储；消费位移监控（lag=最新位-已提交位）。seek() 回拨重放。commitSync 阻塞 vs commitAsync 失败补偿（配 commitSync 兜底）。事务场景的 committed/lastStable offset。
