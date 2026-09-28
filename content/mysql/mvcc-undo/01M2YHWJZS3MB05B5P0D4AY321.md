---
id: 01M2YHWJZS3MB05B5P0D4AY321
blockId: mysql/mvcc-undo
relatedBlocks: []
question: InnoDB 默认的事务隔离级别是什么？
cardType: atomic
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 为什么 InnoDB 选 RR 而不是 SQL 标准默认的更宽松级别？
  - 怎么查看和修改当前会话的隔离级别？
keyPoints:
  - id: kp-4ay321-1
    text: REPEATABLE READ（可重复读）
    public: true
    verifiedAt: 2026-09-20
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html
      locator: 15.7.2.1
---
**隔离级别**是数据库提供的几档「互相干扰程度」设定：档位越严，多个人同时操作时看到的干扰越少，但性能开销越大。

InnoDB 默认选的是中间偏严的一档：**REPEATABLE READ（可重复读，RR）**。特点是：

- 同一个事务里重复执行同一查询，结果稳定不变（这就是「可重复读」名字的由来）；
- 基本防住了幻读（快照读靠 MVCC、当前读靠 next-key lock）；
- 性能代价可以接受。

**术语速查**：隔离级别=互相干扰程度档位｜REPEATABLE READ/可重复读=同事务内重复查询结果稳定｜幻读=第二次查询多出新行

<!--advanced-->
InnoDB 的默认隔离级别是 REPEATABLE READ（可重复读）。在这一级别下，同一事务内的快照读
使用首次读建立的一致性视图，配合 next-key lock 抑制幻读，兼顾一致性与并发性能。
（历史原因：MySQL 早期 statement 格式的 binlog 只有在 RR 下才能保证主从一致，沿用至今。）
