---
id: 01M3KHXF75DZNX5JX7A9JYXJ7V
blockId: mysql/transactions
relatedBlocks: []
question: "脏读、不可重复读、幻读分别是什么？"
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - RC 防住了哪些？RR 呢？
keyPoints:
  - id: kp-tac-2-1
    text: "脏读：读到了别的事务尚未提交、可能被回滚的数据"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-tac-2-2
    text: "不可重复读：同一事务内两次读同一行，值被别人已提交的修改改变了"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-tac-2-3
    text: "幻读：同一事务内两次同范围查询，多出了别人新插入的行"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-tac-2-4
    text: "严重程度递进：脏读 > 不可重复读 > 幻读，隔离级别逐级防住前者"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-tac-2-5
    text: "串行化 SERIALIZABLE 完全防住三种异常，但并发性能最差"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

三种「读的时候被并发写坑了」的异常，一个比一个轻：

1. **脏读**：别人改了还没提交（甚至马上要回滚），你却读到了这个中间值——拿可能作废的数据做决策。
2. **不可重复读**：你事务里两次读**同一行**，中间别人提交了修改，两次值不一样。
3. **幻读**：你事务里两次按条件查**一批行**，第二次多出了别人新插的行（像数队伍人数多了陌生人）。

隔离级别就是「防到哪一档」：读未提交（都不防）→ 读已提交（防脏读）→ 可重复读（再防不可重复读）→ 串行化（全防但性能差）。

**术语速查**：脏读=读到未提交数据｜不可重复读=两次读同行值不同｜幻读=两次范围查询多新行

<!--advanced-->
脏读在 RC 及以上由「只认已提交版本」消除；不可重复读由 RR 的固定 ReadView 消除；幻读在 RR 下快照读靠 MVCC、当前读靠 next-key lock 联合抑制，严格串行化才是完全防。SQL 标准的四级别与 MySQL 实现有差异（InnoDB RR 已部分防幻读）。
