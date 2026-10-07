---
id: 01M3KJ46DKTAGFQW1ZSQZ878EH
blockId: mysql/locks
relatedBlocks: []
question: 共享锁（S）和排他锁（X）的兼容规则是什么？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 两阶段锁协议是什么？
keyPoints:
  - id: kp-lk6-1
    text: S 与 S 兼容：多个事务可同时读同一行
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-lk6-2
    text: X 与任何行锁互斥：改一行时别人的加锁读写都得排队
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-lk6-3
    text: lock in share mode 显式加 S；for update 显式加 X
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M2YHWJHGBGZ57DWPS0FSTNG8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-lk6-4
    text: 普通快照读不加任何行锁（靠 MVCC），与 S/X 都不冲突
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M2YHWJHGBGZ57DWPS0FSTNG8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

行锁的两种**模式**：

- **共享锁（S，读锁）**：「我只想看」——多个事务可以**同时**持有同一行的 S（一起看不打架）。
- **排他锁（X，写锁）**：「我要改」——独占，别人**读（加锁读）写都得等**。

兼容矩阵就两条：S+S ✓，其余（S+X、X+X）✗。

怎么加上：`select ... lock in share mode` 加 S；`select ... for update` 加 X；DML 自动加 X。而**普通 select（快照读）不加锁**——走 MVCC 老照片，谁也不挡。

**术语速查**：S=共享读锁｜X=独占写锁｜兼容矩阵=S+S 可、含 X 皆互斥

<!--advanced-->
InnoDB 遵循两阶段锁协议（2PL）：锁在事务内需要时获取、COMMIT/ROLLBACK 时统一释放（严格 2PL 无提前降级）。S/X 与意向锁 IS/IX 构成完整的兼容矩阵；加锁读与快照读是两条正交路径。
