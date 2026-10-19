---
id: 01M3KJ46DKJSC628EZ54B1WCYS
blockId: mysql/sql-optimization
relatedBlocks: []
question: 什么是覆盖索引？为什么快？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 覆盖索引和联合索引是什么关系？
keyPoints:
  - id: kp-opt4-1
    text: 查询所需的所有列都包含在索引里，无需回表
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KH6MGC234VDTZR8CWF8GHZ
      - 01M3KH6MGEVMPNVC2P2E2KZG96
      - 01M3KHXF75Q620Q8Q4F6P2JSDV
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt4-2
    text: explain Extra 出现 Using index 即覆盖生效
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt4-3
    text: 索引比整行窄得多，扫描的页更少
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KH6MGC234VDTZR8CWF8GHZ
      - 01M3KH6MGE6EHRDCH6S3HP1A64
      - 01M3KHXF75Q620Q8Q4F6P2JSDV
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt4-4
    text: 常用手段：把高频查询的 select 列并入联合索引
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75Q620Q8Q4F6P2JSDV
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
misconceptions:
  - id: mc-opt4-1
    text: "只要 where 条件走了索引，哪怕 select * 也算覆盖索引"
    why: "误解：覆盖与否看 select 要的列是否全在索引里，select * 几乎必带索引外的列，回表照旧"
  - id: mc-opt4-2
    text: "Using index 和 Using index condition 是一回事，都代表覆盖生效"
    why: "误解：前者才是覆盖免回表，后者是索引条件下推（ICP），过滤下推到索引层做，回表依然发生"
  - id: mc-opt4-3
    text: "为了一劳永逸，把查询涉及的字段全部塞进联合索引，越长越好没有代价"
    why: "误解：索引每加一列，写入维护与存储空间都跟着涨，覆盖索引应按高频查询裁剪，不是越宽越赚"
---

**回表**是二级索引的固定税：查到主键还得回主树取整行。**覆盖索引**= 让索引「自带干粮」：**select 和 where 用到的列全部在索引里**，查完索引直接返回，**免回表**。

为什么快：索引树只存几列，比整行窄一个量级——扫的页少、还省第二次查树。`explain` 的 Extra 出现 **Using index** 就是它生效的标志。

工程用法：把高频查询的全部列（如 `select uid, name` + where 条件列）设计进一个联合索引。

**术语速查**：覆盖索引=索引含查询全部所需列｜Using index=explain 的免回表信号

<!--advanced-->
覆盖判定在优化器层完成：所需列集合 ⊆ 索引列集合（含主键隐含列）。注意 select * 天然无法覆盖；索引列过多会劣化写入与 BP 效率，需以查询频度权衡宽度。
