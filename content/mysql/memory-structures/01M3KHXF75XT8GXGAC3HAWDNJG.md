---
id: 01M3KHXF75XT8GXGAC3HAWDNJG
blockId: mysql/memory-structures
relatedBlocks: []
question: Buffer Pool 是什么？为什么重要？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 怎么判断 buffer pool 够不够？
keyPoints:
  - id: kp-mem-1
    text: 缓存磁盘数据页的内存池：读走缓存命中免磁盘，改先改缓存页成为脏页
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem-2
    text: 以页（默认 16KB）为单位管理，是 InnoDB 性能的第一支柱
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem-3
    text: 大小 innodb_buffer_pool_size，通常给到机器内存的 50%~70%
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem-4
    text: 脏页由后台线程按 checkpoint 机制异步刷回磁盘
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem1-5
    text: BP 可划分为多个 instance 降低内部锁争用
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

磁盘比内存慢几万倍，**Buffer Pool** 就是「数据页的内存缓存」：

- **读**：要访问某页先看池里有没有——命中直接用，未命中从磁盘读入池。
- **写**：修改也是改池里的页（改完的叫**脏页**，等着异步刷回磁盘）——这就是 WAL 里「先记日志、页延后刷盘」的那份缓冲。

它通常吃掉机器一大半内存（`innodb_buffer_pool_size` 建议物理内存的 50%~70%），命中率几乎决定数据库读性能。

**术语速查**：buffer pool=数据页内存缓存｜脏页=内存改了未刷盘的页｜命中率=访问在池中命中的比例

<!--advanced-->
BP 以 16KB 页为单元，内部按 LRU 变体（mid-point insertion，young/old 两代）驱逐，change buffer/自适应哈希也挂在 BP 内。刷脏由 page cleaner 线程依脏页比例与 redo 水位驱动。show engine innodb status 的 Buffer pool hit rate 与脏页数为容量健康度核心指标。
