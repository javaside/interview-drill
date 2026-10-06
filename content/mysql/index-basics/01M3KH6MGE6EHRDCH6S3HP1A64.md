---
id: 01M3KH6MGE6EHRDCH6S3HP1A64
blockId: mysql/index-basics
relatedBlocks:
  - mysql/mvcc-undo
question: 聚簇索引和二级索引有什么区别？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 覆盖索引为什么能避免回表？
keyPoints:
  - id: kp-clu-1
    text: 聚簇索引叶子存整行数据；二级索引叶子只存索引列 + 主键值
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
  - id: kp-clu-2
    text: 一张表只有一个聚簇索引（按主键组织），二级索引可以有多个
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
  - id: kp-clu-3
    text: 查二级索引拿不到整行时需回表：拿主键回聚簇索引再查一次
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
  - id: kp-clu-4
    text: 没有显式主键时，InnoDB 用第一个非空唯一索引，或隐藏的 row_id 兜底
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
---

一张 InnoDB 表其实就是一棵按**主键**组织的 B+ 树——这棵树叫**聚簇索引（clustered index）**：叶子层就是数据本身（「数据即索引」）。你在别的列上建索引（比如给 name 建一个），会另起一棵小一点的 B+ 树——**二级索引（secondary index）**。

关键区别在**叶子层存什么**：

- **聚簇索引**：叶子存**整行数据**。按主键查，走到叶子直接拿到整行。
- **二级索引**：叶子只存「索引列的值 + 主键值」。按 name 查，走到叶子只拿到主键——要整行还得**拿主键回聚簇索引再查一次**，这个动作叫**回表（lookup）**。

数量上：聚簇索引**一表只有一棵**（数据只能按一种方式物理排序）；二级索引**可以建多棵**。

**术语速查**：聚簇索引=按主键组织、叶子存整行的那棵主树｜二级索引=其他列上的索引树｜回表=二级索引查到主键后回主树取整行｜row_id=无主键时的隐藏行号

<!--advanced-->
聚簇索引决定了表的物理存储序——主键即数据的物理组织方式，因此一表一棵。二级索引叶子存储 (index_key, primary_key) 对，查询所需列不全在二级索引中时触发回表；若查询列全部能被二级索引覆盖（覆盖索引），则免回表。无主键时 InnoDB 依次选择第一个 NOT NULL UNIQUE 索引，都没有则用隐藏的 6 字节 row_id 单调生成——但隐藏 row_id 全局计数且不可引用，也无法阻止物理重排，生产上应显式定义主键。
