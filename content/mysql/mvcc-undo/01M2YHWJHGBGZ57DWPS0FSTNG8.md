---
id: 01M2YHWJHGBGZ57DWPS0FSTNG8
blockId: mysql/mvcc-undo
relatedBlocks: []
question: RR 隔离级别下 MVCC 会完全避免幻读吗？
cardType: judgment
appliesTo: MySQL 8.0+
frequency: high
conclusion: 'no'
followUps:
  - 那 next-key lock 是怎么补上当前读这个缺口的？
  - 举一个 RR 下仍会读到幻行的具体场景
keyPoints:
  - id: kp-fstng8-1
    text: 不能完全避免：快照读靠 ReadView 不见幻行，但当前读看最新数据仍可能撞见幻行
    public: true
    verifiedAt: 2026-09-20
    excludeAsDistractorFor:
      - 01M3KHXF75DZNX5JX7A9JYXJ7V
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
    excludeAsDistractorFor:
      - 01M3KHXF75EQAKBS12MY82KVGM
      - 01M3KHXF75T0YE2NHBEJRQ9WG6
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html
      locator: 15.7.1 Next-Key Locks
    reasoning: 手册指出 next-key lock 用于防止幻行插入，说明避免幻读的机制是锁而非 MVCC 本身
misconceptions:
  - id: mc-fstng8-1
    text: "MVCC 加上 RR 已经彻底根治幻读，间隙锁在 8.0 里纯属多余"
    why: "误解：固定快照只护住普通 select；带锁的当前读看最新数据仍会撞见新行，挡它靠 next-key lock"
  - id: mc-fstng8-2
    text: "幻读就是两次查询同一行的值不一样，跟不可重复读说的是一回事"
    why: "误解：同行的值变化叫不可重复读；幻读专指同一范围查询冒出全新的行，两者对象与对策都不同"
  - id: mc-fstng8-3
    text: "next-key lock 只是间隙锁的别名，只锁记录之间的空隙，不锁记录本身"
    why: "误解：next-key lock 是记录锁加前隙间隙锁的组合，索引记录本身连同它前面的区间一起锁住"
  - id: mc-fstng8-4
    text: "版本链常驻内存，数据库重启就丢，所以重启后幻读防护会失效"
    why: "误解：旧版本存放在 undo 表空间里，随日志持久化落盘，重启后快照读照常沿链回溯"
  - id: mc-fstng8-5
    text: "ReadView 的活跃事务列表会随别的事务提交实时刷新，新提交的行立刻可见"
    why: "误解：读视图生成时活跃列表就定格了，判断只看建视图那一刻的快照，不随外界提交而变"
---
先说**幻读**是什么：同一个查询执行两次，第二次凭空多出了别人新插入的行——像你在数队伍人数，数第二遍时队伍里多了陌生人。

数据库防幻读有两套手段，各管一种查询：

- **普通查询（快照读）**：用事务开始时第一次查询拍的名单（**ReadView**）看数据，别人后来插的新行不在名单里 → 天然看不到幻行。
- **锁定式查询（当前读**，比如 `select ... for update`、update**）**：必须看**此刻最新**的真实数据 → 名单帮不上忙，就会撞见新插的行。

所以对当前读，数据库用了另一招：把查询扫过的**一段范围**锁起来——这套锁叫 **next-key lock（记录锁 + 间隙锁**，即锁住一行加上行与行之间的空隙**）**，不许别人在这段范围里插新行。新行插不进来，第二次查自然不会多。

**结论：不能完全避免。** RR 防幻读是「快照读用 ReadView + 当前读用 next-key lock」两套机制配合的结果，单靠 MVCC 只堵住快照读这一半。

**术语速查**：幻读=第二次查询多出新行｜快照读=普通查询｜当前读=加锁读最新｜ReadView=可见性名单｜next-key lock=锁行+锁间隙｜MVCC=多版本机制

<!--advanced-->
不能。RR 对幻读的防护由两套机制分工：快照读（普通 select）用事务首次读建立的固定
ReadView，读不到之后其他事务新插入并提交的行，这一层看不到幻行；但当前读
（select ... for update、update、delete）绕过 ReadView 直接读最新已提交数据，单靠
MVCC 就会撞见幻行。

InnoDB 用 next-key lock（记录锁 + 间隙锁）在当前读时锁住扫描到的区间，阻止其他事务
在区间内插入新行，才把当前读这条缝补上。所以严格说，RR 下避免幻读是 MVCC 与
next-key lock 共同的结果，MVCC 单独做不到。
