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

InnoDB 的默认隔离级别是 REPEATABLE READ（可重复读）。在这一级别下，同一事务内的快照读
使用首次读建立的一致性视图，配合 next-key lock 抑制幻读，兼顾一致性与并发性能。
