---
id: 01M3KHXF750A1FEDHQBMPJ60VW
blockId: mysql/sql-optimization
relatedBlocks: []
question: EXPLAIN 输出里最该关注哪些列？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - rows 是怎么估出来的？
keyPoints:
  - id: kp-opt-1
    text: type：访问类型，是否走索引、走得好不好（好→差：const→ref→range→index→ALL）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KJ46DK95AVBNDQ9Z02CCAK
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt-2
    text: key / key_len：实际用了哪个索引、用了几列
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KJ46DK95AVBNDQ9Z02CCAK
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt-3
    text: rows：预估扫描行数，数量级直接反映代价
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KJ46DK95AVBNDQ9Z02CCAK
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt-4
    text: Extra：Using filesort/Using temporary 是坏味道；Using index 是好信号
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KJ46DK95AVBNDQ9Z02CCAK
      - 01M3KJ46DKJSC628EZ54B1WCYS
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

`EXPLAIN` 把优化器**打算怎么执行**这条 SQL 摆给你看。四列最要紧：

- **type（访问类型）**：数据怎么拿的。`ALL` = 全表扫（红旗）；`ref/range` = 用了索引；`const` = 主键等值一发命中。
- **key / key_len**：真用了哪个索引、联合索引用了前几列——「possible_keys 一堆 key 为空」= 有索引没用上。
- **rows**：预估要扫的行数——1 千和 1 百万的差别不用解释。
- **Extra**：`Using index`（覆盖索引，不用回表，好）；`Using filesort`（额外排序）、`Using temporary`（临时表，坏味道）。

**术语速查**：执行计划=优化器的执行方案｜访问类型=取数方式｜覆盖索引=索引里就有全部所需列

<!--advanced-->
基于成本优化：cost ≈ IO 成本 + CPU 成本，依赖索引统计（cardinality，采样于 information_schema.STATISTICS/innochecksum）。rows 为索引 dive 或统计均值估算，统计过期（analyze table 修正）会导致选错索引。8.0 的 invisible index 可在不删索引前提下让优化器忽略以做对照实验。
