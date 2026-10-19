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

misconceptions:
  - id: mc-bi2-1
    text: "实例崩溃重启后 InnoDB 会重放 binlog 把数据修复到崩溃前"
    why: "误解：实例自愈只认 redo，binlog 的舞台是主从复制和按时间点恢复，重启修复用不上它"
  - id: mc-bi2-2
    text: "MyISAM 表的写入也会记录 redo log，所以它同样具备崩溃自动恢复能力"
    why: "误解：redo 是 InnoDB 的私有账本，MyISAM 的写入只进 binlog，这正是 MyISAM 崩溃后容易坏表的原因"
  - id: mc-bi2-3
    text: "binlog 文件写满后会循环覆盖最老的文件，空间回收方式与 redo 一致"
    why: "误解：binlog 只追加不覆盖，过期清理由 binlog_expire_logs_seconds 控制，循环覆盖是 redo 固定文件组的做法"
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
