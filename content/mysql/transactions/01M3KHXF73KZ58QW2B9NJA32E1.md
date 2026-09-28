---
id: 01M3KHXF73KZ58QW2B9NJA32E1
blockId: mysql/transactions
relatedBlocks: []
question: "事务的 ACID 四个特性分别是什么意思？"
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - InnoDB 分别用什么机制实现这四个特性？
keyPoints:
  - id: kp-tac-1
    text: "原子性 Atomicity：事务内的操作要么全部生效，要么全部不生效（回滚）"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-tac-2
    text: "一致性 Consistency：事务前后数据都满足业务约束，处于合法状态"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-tac-3
    text: "隔离性 Isolation：并发事务互不干扰，像各自独占数据库一样"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-tac-4
    text: "持久性 Durability：事务一旦提交，断电重启后修改仍在"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

**事务（transaction）**= 一组「要么全成、要么全不算」的操作。转账 100 元 = 「你 -100」和「我 +100」两步，只做一半就是事故。ACID 是衡量一个事务系统靠不靠谱的四个标准：

- **原子性（A）**：全做或全不做。做到一半崩溃/反悔 → 按 undo log（草稿本）撤销。
- **一致性（C）**：结果符合业务规则。钱的总数转账前后不变、外键不被破坏。C 是目的，A/I/D 是手段。
- **隔离性（I）**：多人同时用时互相看不见对方没提交的修改，靠锁 + MVCC（多版本）实现。
- **持久性（D）**：提交成功 = 修改永久落地，断电也不丢，靠 redo log（流水账）实现。

**术语速查**：原子性=全做或全不做｜一致性=结果合法｜隔离性=并发互不干扰｜持久性=提交即永久

<!--advanced-->
A 由 undo log 保证（回滚逆向应用）；D 由 redo log + WAL 保证（先写日志后写数据页，崩溃后重放）；I 由锁（写写互斥）与 MVCC（读写不阻塞）共同保证；C 是三者叠加应用层约束的结果。InnoDB 以 undo/redo/锁/ReadView 四件套落地 ACID。
