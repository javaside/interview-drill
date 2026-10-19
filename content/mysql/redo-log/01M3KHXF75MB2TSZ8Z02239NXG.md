---
id: 01M3KHXF75MB2TSZ8Z02239NXG
blockId: mysql/redo-log
relatedBlocks: []
question: redo log 的作用是什么？什么是 WAL？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - checkpoint 是什么？
keyPoints:
  - id: kp-rd-1
    text: 记录「做了什么修改」的物理日志，崩溃后照它重放，保证已提交修改不丢
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF73KZ58QW2B9NJA32E1
      - 01M3KHXF75A058357P4PBBKMCG
      - 01M3KHXF75EKCGXWRF72ZN6EE0
      - 01M3KJ46DK9NYNFFFMJJDEYHVP
      - 01M3NCQ6WZ83YT2YSABFFVPAST
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd-2
    text: WAL 先写日志后写数据页：修改先记 redo，数据页延后刷盘
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF73KZ58QW2B9NJA32E1
      - 01M3KHXF75EKCGXWRF72ZN6EE0
      - 01M3KJ46DK9NYNFFFMJJDEYHVP
      - 01M3NCQ6WZ83YT2YSABFFVPAST
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd-3
    text: 顺序写日志代替随机写数据页，性能高数个量级
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75EKCGXWRF72ZN6EE0
      - 01M3NCQ6WZ2NN8RWDEQY5XT6X8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd-4
    text: redo 是循环写的固定大小文件组，写满触发 checkpoint 强制刷脏页
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75A058357P4PBBKMCG
      - 01M3KHXF75EKCGXWRF72ZN6EE0
      - 01M3KJ46DK7WT94BWAHSE3FNZB
      - 01M3KJ46DKA96Z7J019CVJXCAY
      - 01M3NCQ6WZ83YT2YSABFFVPAST
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
misconceptions:
  - id: mc-rd-1
    text: "redo log 记录某行某列被改成了什么值，回滚就靠它逆向执行"
    why: "误解：按行记修改前后值、供回滚逆推的是 undo log，redo 记的是页级物理修改供崩溃后重放"
  - id: mc-rd-2
    text: "WAL 的要求是事务提交前把改过的数据页全部刷盘，日志随后补写"
    why: "误解：顺序恰好相反：先持久化的是日志，数据页保持脏态延后刷，这正是省掉随机写的关键"
  - id: mc-rd-3
    text: "redo log 文件写满会自动扩容，长事务也不会把写入卡住"
    why: "误解：redo 容量固定、循环复用，写满只能强推 checkpoint 刷脏页腾出空间，新写入被迫排队让位"
---

**持久性问题**：内存里改完的数据要写到磁盘才不怕断电，但每次修改都立刻刷磁盘太慢（随机写、每次一页）。

**redo log（重做日志）**的解法——**WAL（Write-Ahead Logging，先写日志）**：

1. 修改数据页时，先把「我把某页某位置改成了什么」**追加**到 redo log（**顺序写**，快几个数量级）；
2. 真正的数据页**之后**由后台慢慢刷盘（「脏页」）；
3. 断电了？重启照 redo log **重放**一遍，已提交的修改全部找回来。

redo 是**循环写**的固定大小文件（如 2 个 1GB）：写满一圈就得强制把最老的脏页刷盘腾地方（**checkpoint**），所以它只保「最近一段」，不是无限账本。

**术语速查**：redo log=修改流水账｜WAL=先记账后改页｜脏页=内存改了未刷盘的页｜checkpoint=强制刷脏腾出日志空间

<!--advanced-->
redo 是物理页级日志（page-level change），循环写入 fixed-size file group（innodb_log_file_size × 数量）。性能本质：日志顺序 append 替代数据页随机 fsync。checkpoint（模糊检查点）推进 LSN 水位，恢复只需重放 checkpoint 之后的日志。
