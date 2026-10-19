---
id: 01M3KHXF759MW5MDSZP7N251BB
blockId: mysql/redo-log
relatedBlocks: []
question: innodb_flush_log_at_trx_commit 和 sync_binlog 这「双 1」是什么？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 性能敏感场景常见的 100/2 组合牺牲了什么？
keyPoints:
  - id: kp-rd2-1
    text: innodb_flush_log_at_trx_commit=1：每次提交把 redo 刷盘，最安全
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZ83YT2YSABFFVPAST
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd2-2
    text: '=0 时每秒刷一次，宕机丢最多 1 秒已提交事务'
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZ83YT2YSABFFVPAST
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd2-3
    text: '=2 时写到 OS 缓存每秒 fsync，MySQL 崩不丢、主机崩丢 1 秒'
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZ83YT2YSABFFVPAST
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd2-4
    text: sync_binlog=1：每次提交 fsync binlog——与 redo=1 合称「双 1」，最可靠配置
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75EKCGXWRF72ZN6EE0
      - 01M3NCQ6WZ83YT2YSABFFVPAST
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
misconceptions:
  - id: mc-rd2-1
    text: "innodb_flush_log_at_trx_commit 设为 2 就高枕无忧，主机断电也不丢事务"
    why: "误解：2 只把 redo 写到操作系统缓存，掉电连缓存一起清掉，主机级宕机仍丢最多约 1 秒"
  - id: mc-rd2-2
    text: "参数 0 和 2 的安全性没有区别，反正都是每秒刷一次盘"
    why: "误解：mysqld 崩溃时 2 的日志已交到操作系统层保住、0 还留在日志缓冲里会丢 1 秒；两者只对主机掉电同样脆弱"
  - id: mc-rd2-3
    text: "sync_binlog=1 的意思是每秒同步一次 binlog"
    why: "误解：1 指每次事务提交都 fsync 一次 binlog；0 是完全交给操作系统安排落盘，不按秒计数"
---

**可靠性 vs 性能**的两个总开关：

**redo 侧**（`innodb_flush_log_at_trx_commit`）——提交时 redo 刷到哪：
- `1`：每次提交都 **fsync 到磁盘**。宕机不丢任何已提交事务（最慢最安全）。
- `0`：每秒刷一次。宕机最多**丢 1 秒**的已提交事务。
- `2`：每次提交写到**操作系统缓存**，每秒 fsync。MySQL 进程崩不丢；**主机**崩才丢 1 秒。

**binlog 侧**（`sync_binlog`）——提交时 binlog 刷到哪：`1`=每次 fsync；`0`=交给 OS；`N`=攒 N 个事务刷一次。

**「双 1」** = 两个都设 1：主库不丢任何已提交数据，金融级标配。性能换可靠——每次提交两次磁盘 fsync。

**术语速查**：fsync=强制刷到物理磁盘｜双 1=两个开关都设 1 的最可靠配置

<!--advanced-->
两参数分别守护 redo 与 binlog 的持久性，须与两阶段提交配合理解：redo 处于 prepare 而 binlog 未落盘时崩溃 → 回滚；binlog 已落盘 → 提交。非双 1 配置破坏的是「已提交事务不丢」的边界，且可能引发主从不一致（binlog 丢失）。
