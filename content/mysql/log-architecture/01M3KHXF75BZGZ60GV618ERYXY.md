---
id: 01M3KHXF75BZGZ60GV618ERYXY
blockId: mysql/log-architecture
relatedBlocks: []
question: 两阶段提交（redo 与 binlog）为什么必要？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 崩溃恢复时怎么裁定 prepare 状态的事务？
keyPoints:
  - id: kp-log-1
    text: 一次提交要同时写 redo 与 binlog 两本账，任何顺序都存在中间态
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75EKCGXWRF72ZN6EE0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-log-2
    text: 先 binlog 后 redo：崩溃于中间→主库回滚而从库已重放→主少从多
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75EKCGXWRF72ZN6EE0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-log-3
    text: 先 redo 后 binlog：崩溃于中间→主库已提交而从库没收到→主多从少
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75EKCGXWRF72ZN6EE0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-log-4
    text: 解法：redo 先写为 prepare，binlog 落盘成功后才把 redo 标记 commit——崩溃恢复以 binlog 是否完整裁定
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF759MW5MDSZP7N251BB
      - 01M3KHXF75EKCGXWRF72ZN6EE0
      - 01M3KJ46DK9NYNFFFMJJDEYHVP
      - 01M3NCQ6WZ2YRJHBP2A6CJ4W7R
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

一次提交要写**两本账**：redo（InnoDB 自己恢复用）和 binlog（从库/备份用）。**不管先写谁，崩溃在中间都会两账不一致**：

- 先 binlog 后 redo：崩了 → 主库回滚、从库已重放 → **主少从多**；
- 先 redo 后 binlog：崩了 → 主库算提交、从库没收到 → **主多从少**。

**两阶段提交**（内部 XA）消除中间态：

1. redo 写入并标记 **prepare**（「我想提交，先立此存照」）；
2. 写 **binlog** 并落盘；
3. 回头把 redo 标记 **commit**。

崩溃恢复的**裁定规则**：发现 prepare 状态的事务 → 查 binlog——**完整则提交，不完整则回滚**。以 binlog 为准绳，两本账永远一致。

**术语速查**：两阶段提交=prepare→binlog→commit｜prepare=已预告未成交｜裁定=以 binlog 完整性定生死

<!--advanced-->
组提交（group commit）将同刻多个事务的 binlog/redo 合并一次 fsync 摊薄 IO。sync_binlog 与 innodb_flush_log_at_trx_commit 的非双 1 配置会放宽各自 fsync 时机但不改顺序语义。8.0.30+ 的 binlog 与 redo 均含 GTID/事务边界以支持崩溃后的精确对账。
