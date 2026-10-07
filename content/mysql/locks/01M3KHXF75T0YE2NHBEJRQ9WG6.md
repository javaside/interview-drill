---
id: 01M3KHXF75T0YE2NHBEJRQ9WG6
blockId: mysql/locks
relatedBlocks: []
question: InnoDB 有哪些锁的层级？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 为什么 DDL 可能被一行记录阻塞很久？
keyPoints:
  - id: kp-lk2-1
    text: 全局锁：FTWRL 让整库只读，用于逻辑备份
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-lk2-2
    text: 表锁：lock tables 或 DDL 加在表级别，锁粒度大、并发差
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KJ46DHF8DAT54DRTRGZ3GT
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-lk2-3
    text: 行锁：InnoDB 在索引记录上加锁，粒度最细、并发最好
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75EQAKBS12MY82KVGM
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-lk2-4
    text: 意向锁：表级「占位声明」，快速判断表里是否有行锁，避免逐行检查
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

锁的**粒度**从粗到细：

- **全局锁**：`FLUSH TABLES WITH READ LOCK`，整库只读。mysqldump 老式全量备份用过。
- **表锁**：整张表一把锁。DDL（改表结构）会隐式加；粒度太粗，写互相全挡。
- **行锁**：InnoDB 的看家本领——只锁涉及的**索引记录**，没碰到的行随便别人读写。
- **意向锁（IS/IX）**：表上的「告示牌」。事务加行锁前先在表上挂牌「我在里面锁了行」——别人想加表锁时看一眼牌子就知道要等，不用逐行扫。

**术语速查**：粒度=锁的范围大小｜意向锁=表级声明牌｜行锁加在索引记录上

<!--advanced-->
行锁实现为索引记录上的锁（record/gap/next-key），无索引可用时退化为全表扫描并对全部记录加锁（等效锁表）。意向锁 IS/IX 只与表级锁冲突、彼此兼容，作用是把「表锁 vs 行锁」的冲突检测从 O(行数) 降为 O(1)。
