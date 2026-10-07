---
id: 01M3KJ46DK7WT94BWAHSE3FNZB
blockId: mysql/log-architecture
relatedBlocks: []
question: MySQL 一条 SQL 的 IO 链路上有哪些缓冲/缓存？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: mid
followUps:
  - flush_log_at_trx_commit=2 与 =1 的差别在链路上处于哪一环？
keyPoints:
  - id: kp-log5-1
    text: buffer pool：数据页的内存缓存，命中免磁盘
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75XT8GXGAC3HAWDNJG
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-log5-2
    text: log buffer：redo 的内存缓冲，事务提交时刷盘
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF759MW5MDSZP7N251BB
      - 01M3KHXF75MB2TSZ8Z02239NXG
      - 01M3NCQ6WZ83YT2YSABFFVPAST
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-log5-3
    text: OS page cache：文件系统缓存，redo/binlog 的 fsync 边界即冲它
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZ83YT2YSABFFVPAST
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-log5-4
    text: change buffer：非唯一二级索引改动的暂存区
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75G0DM6BH2RG78KD4D
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

一条 SQL 的修改要穿过**四层缓冲**才真正到磁盘：

1. **Buffer Pool**：数据页缓存——读命中/改内存页（脏页）都在这层，最挡 IO 的一层；
2. **Log Buffer**：redo 先记在这（内存），提交时按 `innodb_flush_log_at_trx_commit` 决定刷到哪；
3. **OS Page Cache**：操作系统的文件缓存——「写到 OS 缓存」≠ 落盘，`fsync` 才真落（=1 与 =2 的分界正在这环：1 是每次 fsync 过缓存，2 是写进缓存就返回）；
4. **Change Buffer**：旁路——非唯一二级索引的改动先暂存，延后合并。

排障时先分清卡在哪层：BP 不够？log buffer 刷盘策略？还是 OS 缓存到磁盘的 fsync 排队？

**术语速查**：BP=页缓存｜log buffer=redo 缓冲｜OS cache=文件缓存（fsync 才落盘）｜change buffer=二级索引暂存

<!--advanced-->
各层容量/策略参数：innodb_buffer_pool_size、innodb_log_buffer_size、innodb_flush_log_at_trx_commit/sync_binlog（fsync 语义边界）、innodb_change_buffering。io_uring 与 O_DIRECT 绕过 OS cache 的形态（innodb_flush_method=O_DIRECT）改变第三层角色。
