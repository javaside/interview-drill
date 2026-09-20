---
id: 01M2YHWHM1GXWK41NFFXJBJ3JW
blockId: mysql/mvcc-undo
relatedBlocks: []
question: RC 和 RR 隔离级别下 ReadView 的生成时机有什么不同？
cardType: comparison
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 这个差别怎么导致 RC 出现不可重复读？
  - 当前读（select ... for update）走不走 ReadView？
keyPoints:
  - id: kp-jbj3jw-1
    text: RC 在事务内每次快照读都新建一个 ReadView
    public: true
    verifiedAt: 2026-09-20
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html
      locator: 15.7.2.1 READ COMMITTED
  - id: kp-jbj3jw-2
    text: RR 在事务内第一次快照读时建 ReadView，之后整个事务复用它
    public: false
    verifiedAt: 2026-09-20
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html
      locator: 15.7.2.1 REPEATABLE READ
    reasoning: 手册说 RR 下同一事务的一致性读读的是首次读建立的快照，故 ReadView 在首次快照读时生成并复用
  - id: kp-jbj3jw-3
    text: 因此 RC 每次读都能看到已提交的新数据，RR 整个事务看到同一份快照
    public: false
    verifiedAt: 2026-09-20
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html
      locator: 15.7.2.1
    reasoning: 生成时机的差异直接决定可见性范围：每次新建则跟随最新提交，复用则固定在首次时刻
  - id: kp-jbj3jw-4
    text: RC 会出现不可重复读，RR 在快照读层面消除不可重复读
    public: false
    verifiedAt: 2026-09-20
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/glossary.html
      locator: "glossary: non-repeatable read"
    reasoning: 由 ReadView 复用与否推出：同一查询两次结果是否可能不同
  - id: kp-jbj3jw-5
    text: 两者的当前读都读最新已提交版本，与 ReadView 无关
    public: false
    verifiedAt: 2026-09-20
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html
      locator: 15.7.2.4 Locking Reads
---

RC 与 RR 的核心差别在 ReadView 的生成时机。ReadView 是快照读时对"当前哪些事务已提交"
的一次快照，它决定版本链上哪一版对本次读可见。

RC 下每一次快照读都重新建 ReadView，所以每次读都能看见此刻最新的已提交数据——这正是
不可重复读的来源。RR 下只有事务里第一次快照读才建 ReadView，之后整个事务复用它，因此
两次相同查询看到的是同一份快照，快照读层面不出现不可重复读。

注意这只针对快照读（普通 select）。当前读（select ... for update、update 等）在两种
隔离级别下都直接读最新已提交版本并加锁，不走 ReadView。
