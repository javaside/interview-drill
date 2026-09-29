---
id: 01M3KJ46DKNPM6MJHD973CJ7BF
blockId: mysql/memory-structures
relatedBlocks: []
question: "自适应哈希索引（AHI）是什么？"
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: low
followUps:
  - 为什么高并发写入场景有时要关掉它？
keyPoints:
  - id: kp-mem5-1
    text: "InnoDB 自动对热点页建哈希入口，同值条件查询不再逐层爬 B+ 树"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem5-2
    text: "AHI 命中率可在 show engine innodb status 中观测"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem5-3
    text: "高并发写入时保护 AHI 的全局 latch 争抢反成瓶颈，可关闭"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

B+ 树等值查找要走 3~4 层（3~4 次页访问）。如果某些页被**反复等值命中**，InnoDB 会自动给它们建**哈希表入口**——下次等值查询一步到位，树都不用爬。这就是**自适应哈希索引（AHI）**，全自动、无法手工指定。

它护着 BP 的全局锁（latch），**高并发写入**时争抢这个锁反而成为瓶颈——所以有些场景会主动关掉（`innodb_adaptive_hash_index=off`）。

**术语速查**：AHI=热点页的自动哈希捷径｜latch=保护内存结构的轻量锁

<!--advanced-->
AHI 由后台线程依搜索模式统计自动构建（naive hash on page records），命中条件苛刻（精确前缀等值）。show engine innodb status 的 SEARCH sections 可观测命中率；row lock/ahi 的 btr0sea latch 争用体现为 RW-shared spins 升高时建议关闭。
