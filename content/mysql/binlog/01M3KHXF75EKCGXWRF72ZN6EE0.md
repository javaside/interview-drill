---
id: 01M3KHXF75EKCGXWRF72ZN6EE0
blockId: mysql/binlog
relatedBlocks: []
question: binlog 和 redo log 的区别？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 为什么需要两阶段提交来协调它们？
keyPoints:
  - id: kp-bi2-1
    text: 层次：binlog 是 Server 层（所有引擎）；redo 是 InnoDB 引擎层
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75BZGZ60GV618ERYXY
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi2-2
    text: 内容：binlog 逻辑日志（语句/行变化）；redo 物理日志（页级改动）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi2-3
    text: 写法：binlog 追加写不循环；redo 循环写固定文件组
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi2-4
    text: 用途：binlog 复制与归档恢复；redo 崩溃恢复
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75BZGZ60GV618ERYXY
      - 01M3KHXF75MB2TSZ8Z02239NXG
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

两本**层次不同**的账：

| | binlog | redo |
|---|---|---|
| 属于 | Server 层，**所有**存储引擎共用 | InnoDB 私有 |
| 记什么 | 逻辑：SQL 语句或行的变化 | 物理：哪个页哪个位置改了什么 |
| 怎么写 | 追加、不覆盖 | 循环写固定大小 |
| 干什么用 | 主从复制、按时间点恢复 | 宕机后恢复已提交数据 |

一个改库操作两边都要记（redo 保自己崩溃恢复，binlog 供从库/备份）——**两笔账必须一致**，谁先谁后崩了都会主从不一致。这正是「两阶段提交」要解决的问题（redo prepare → binlog → redo commit）。

**术语速查**：Server 层=引擎之上的公共层｜逻辑日志=记操作语义｜物理日志=记页级字节改动

<!--advanced-->
崩溃恢复的裁定：redo 处于 prepare 且 binlog 完整 → 提交；binlog 不完整 → 回滚。若先写 binlog 后写 redo，崩溃于中间则主库回滚而从库已重放 → 主多从少；反之则主少从多。两阶段提交以 binlog 为协调点保证原子性跨越两层日志。
