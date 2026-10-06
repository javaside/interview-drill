---
id: 01M3NE18CNDSRTSJCNEHRAVWH0
blockId: distributed/arch-evolution
relatedBlocks: []
question: 读写分离和 CQRS？
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - 写完立刻读怎么办？
keyPoints:
  - id: kp-ae3-1
    text: 读写分离：主写从读——读扩容的第一步
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ae3-2
    text: 主从延迟问题：写后立读可能读到旧值（路由强制的坑）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ae3-3
    text: CQRS：命令与查询模型分离——写库与读库异构
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ae3-4
    text: 同步管道：binlog/CDC 驱动写模型→读模型（ES/宽表）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

**读写分离**：写走主库、读走从库——**读压力**的水平扩展第一步。直接坑：**主从延迟**（毫秒~秒）——「下单成功」跳转订单列表却查不到（读到还没同步的从库）。

**写后读的四种解**：①**关键路径强制读主**（写后 N 秒内该用户的读路由主库—— ShardingSphere hint）；②**会话粘性**（写后的会话短时间全主库）；③**业务侧回显**（写接口直接返回结果，不用再查）；④等复制（显式 wait——慢）。

**CQRS**（命令查询职责分离）是读写分离的完全体：**写模型**（规范化 DB，保一致）与**读模型**（ES/宽表/物化视图，为查询形状定制）**物理分开**，binlog/CDC 异步同步——各自最优形态，代价是**最终一致窗口**与双模型维护。

**术语速查**：写后立读=延迟窗口的经典坑｜强制读主=短窗粘主库｜异构读模型=为查询定制的另一份

<!--advanced-->
CDC 工具（canal/debezium：伪装 MySQL 从库收 binlog）。读模型的重建（全量重放+增量追平）。eventual consistency 的 UI 应对（乐观更新/加载态）。
