---
id: 01M3KHXF757YPGRM9WQ11B8Y9J
blockId: mysql/binlog
relatedBlocks: []
question: 主从复制的流程是怎样的？异步复制意味着什么风险？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - GTID 解决了什么问题？
keyPoints:
  - id: kp-bi3-1
    text: 主库写 binlog；dump 线程推给从库；从库 IO 线程写入 relay log
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi3-2
    text: 从库 SQL 线程（或 coordinator+worker）重放 relay log
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi3-3
    text: 异步复制：主库提交不候从库，宕机可能丢最新事务
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi3-4
    text: 半同步：至少一个从库确认收到 binlog 才返回提交；损失性能换不丢
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'

misconceptions:
  - id: mc-bi3-1
    text: "从库 IO 线程收到 binlog 后直接执行其中的语句，不需要别的线程参与"
    why: "误解：IO 线程只管收货入库（写 relay log），执行日志内容是 SQL 线程的活，两条线程各司其职"
  - id: mc-bi3-2
    text: "半同步复制要候从库把事务重放完才向客户端返回成功"
    why: "误解：半同步的确认点是 IO 线程收到 binlog，不是重放完成，relay log 里排队的事务仍可能滞后"
  - id: mc-bi3-3
    text: "半同步模式下主库要收到全部从库的确认才返回提交"
    why: "误解：默认只要一个从库确认收到即可，想增加确认数量需显式调大对应参数"
---

**复制流程**（三线程接力）：

```
主库：事务提交 → 写 binlog → dump 线程把 binlog 推给从库
从库：IO 线程收下 → 存进 relay log（中继日志）
从库：SQL 线程读 relay log → 重放执行
```

**异步复制**（默认）：主库写完 binlog 立即告诉客户端「提交成功」，不等从库跟上。主库突然宕机时，从库可能还没收到最后几个事务 → **提升从库为主后会丢这部分数据**。半同步复制（`rpl_semi_sync`）要求至少一个从库**确认收到**才返回成功，用延迟换不丢。

**术语速查**：relay log=从库的中转日志｜异步=不等从库确认｜半同步=至少一从库确认

<!--advanced-->
并行复制（LOGICAL_CLOCK / WRITESET）缓解 SQL 线程单线程重放延迟。GTID=server_uuid:seq 全局事务标识，从库自动对位避免手工 file+pos，且可校验主从事务集差异。故障切换丢数据窗口 = 异步下未传binlog的事务集合。
