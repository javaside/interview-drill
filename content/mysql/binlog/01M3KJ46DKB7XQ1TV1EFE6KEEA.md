---
id: 01M3KJ46DKB7XQ1TV1EFE6KEEA
blockId: mysql/binlog
relatedBlocks: []
question: relay log 堆积说明什么？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: mid
followUps:
  - Seconds_Behind_Master 为 0 一定没延迟吗？
keyPoints:
  - id: kp-bi5-1
    text: relay log=从库收到 binlog 的中转文件；堆积=SQL 线程重放速度跟不上主库写入
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF757YPGRM9WQ11B8Y9J
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi5-2
    text: 常见原因：从库单线程重放、大事务、从库负载高或锁僵持
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi5-3
    text: 影响：主从延迟扩大，读从库拿到旧数据
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF757YPGRM9WQ11B8Y9J
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi5-4
    text: 缓解：并行复制（LOGICAL_CLOCK/WRITESET）、拆大事务、扩从库资源
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

从库的**中转日志（relay log）**是 IO 线程收货、SQL 线程取货的仓库。**堆积** = 收得快、放得慢：SQL 线程重放跟不上主库的产生速度。

典型原因：重放是单线程（老版本）、主库来了**大事务**、从库机器差/有锁等待。后果即**主从延迟**——你读从库，读到的是旧世界。

缓解：开**并行复制**（按组提交/写集并行重放）、把大事务拆小、给从库加资源。

**术语速查**：relay log=从库中转仓｜主从延迟=从库落后主库的时间差｜并行复制=多线程重放

<!--advanced-->
MTS 的 coordinator 按 slave_parallel_workers 分发，可并行粒度由 binlog group commit 或 WRITESET（依赖冲突矩阵）决定。SBM=0 仅代表 IO 线程追平，事务级延迟要用 pt-heartbeat 或 GTID 差集观测。
