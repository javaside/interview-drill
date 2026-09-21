---
id: 01M2YHWJHGBGZ57DWPS0FSTNG8
blockId: mysql/mvcc-undo
relatedBlocks: []
question: RR 隔离级别下 MVCC 能完全避免幻读吗？
cardType: judgment
appliesTo: MySQL 8.0+
frequency: high
conclusion: no
followUps:
  - 那 next-key lock 是怎么补上当前读这个缺口的？
  - 举一个 RR 下仍会读到幻行的具体场景
keyPoints:
  - id: kp-fstng8-1
    text: 不能完全避免：快照读靠 ReadView 不见幻行，但当前读看最新数据仍可能撞见幻行
    public: true
    verifiedAt: 2026-09-20
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html
      locator: 15.7.2.1 REPEATABLE READ
    reasoning: RR 的一致性读用固定 ReadView 挡住快照读的幻读，但当前读绕过 ReadView 读最新版本，故 MVCC 单独不足以消除幻读
  - id: kp-fstng8-2
    text: InnoDB 靠 next-key lock（间隙锁）在当前读时锁住范围，才补上这个缺口
    public: false
    verifiedAt: 2026-09-20
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html
      locator: 15.7.1 Next-Key Locks
    reasoning: 手册指出 next-key lock 用于防止幻行插入，说明避免幻读的机制是锁而非 MVCC 本身
---

不能。RR 对幻读的防护由两套机制分工：快照读（普通 select）用事务首次读建立的固定
ReadView，读不到之后其他事务新插入并提交的行，这一层看不到幻行；但当前读
（select ... for update、update、delete）绕过 ReadView 直接读最新已提交数据，单靠
MVCC 就会撞见幻行。

InnoDB 用 next-key lock（记录锁 + 间隙锁）在当前读时锁住扫描到的区间，阻止其他事务
在区间内插入新行，才把当前读这条缝补上。所以严格说，RR 下避免幻读是 MVCC 与
next-key lock 共同的结果，MVCC 单独做不到。
