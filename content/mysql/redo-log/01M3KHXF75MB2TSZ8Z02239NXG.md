---
id: 01M3KHXF75MB2TSZ8Z02239NXG
blockId: mysql/redo-log
relatedBlocks: []
question: "redo log 的作用是什么？什么是 WAL？"
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - checkpoint 是什么？
keyPoints:
  - id: kp-rd-1
    text: "记录「做了什么修改」的物理日志，崩溃后照它重放，保证已提交修改不丢"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd-2
    text: "WAL 先写日志后写数据页：修改先记 redo，数据页延后刷盘"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd-3
    text: "顺序写日志代替随机写数据页，性能高数个量级"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd-4
    text: "redo 是循环写的固定大小文件组，写满触发 checkpoint 强制刷脏页"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
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
