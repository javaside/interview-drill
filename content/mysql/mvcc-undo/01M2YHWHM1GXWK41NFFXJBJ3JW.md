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
    excludeAsDistractorFor:
      - 01M2YHWJHGBGZ57DWPS0FSTNG8
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
    excludeAsDistractorFor:
      - 01M2YHWJHGBGZ57DWPS0FSTNG8
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
    excludeAsDistractorFor:
      - 01M3KHXF75DZNX5JX7A9JYXJ7V
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/glossary.html
      locator: 'glossary: non-repeatable read'
    reasoning: 由 ReadView 复用与否推出：同一查询两次结果是否可能不同
  - id: kp-jbj3jw-5
    text: 两者的当前读都读最新已提交版本，与 ReadView 无关
    public: false
    verifiedAt: 2026-09-20
    excludeAsDistractorFor:
      - 01M2YHWJHGBGZ57DWPS0FSTNG8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html
      locator: 15.7.2.4 Locking Reads
---
背景：多个人同时用数据库，需要规定「互相能看到对方多少修改」，这就是**隔离级别**。其中 **RR（REPEATABLE READ，可重复读）**要求：同一个事务里，同一条查询执行两次，结果必须一样。

**ReadView** 可以理解成一张**名单**：拍下这一刻「哪些人的修改算数（已提交）」。普通查询（术语叫**快照读**）只认名单上的版本。

两种级别的区别就在**拍名单的时机**：

- **RC（READ COMMITTED，读已提交）**：每次查询都重新拍一张名单 → 每次都能看到别人最新提交的修改 → 同一事务里两次查询可能不同——这个现象叫**不可重复读**。
- **RR（可重复读）**：只在第一次查询时拍名单，之后整个事务都用这一张 → 两次查询看到同一份快照，结果必然一样。

另外一种查询不走名单：**当前读**（比如 `select ... for update`、update、delete）——它必须**到现场看此刻最新的真实数据**并加锁，不查名单、不看旧版本。

为什么不能看照片？假设 x 的真实值已经是 10（别人已提交的修改），而你的照片里 x 还是 8——如果你基于照片执行 `update x = x + 1`，会算出 9 写回去，把别人 10 → 11 的修改**直接冲掉**（这叫丢失更新）。所以凡是「要动手改/锁数据」的读，一律绕过 ReadView、直读最新已提交版本再加锁。也因此 RC 和 RR 的差异**只存在于快照读**——当前读在两个级别下行为完全相同。

**术语速查**：隔离级别=互相干扰程度的规定｜ReadView=可见性名单｜快照读=普通查询｜当前读=加锁读最新｜不可重复读=两次查询结果不同

<!--advanced-->
RC 与 RR 的核心差别在 ReadView 的生成时机。ReadView 是快照读时对"当前哪些事务已提交"
的一次快照，它决定版本链上哪一版对本次读可见。

RC 下每一次快照读都重新建 ReadView，所以每次读都能看见此刻最新的已提交数据——这正是
不可重复读的来源。RR 下只有事务里第一次快照读才建 ReadView，之后整个事务复用它，因此
两次相同查询看到的是同一份快照，快照读层面不出现不可重复读。

注意这只针对快照读（普通 select）。当前读（select ... for update、update 等）在两种
隔离级别下都直接读最新已提交版本并加锁，不走 ReadView。
