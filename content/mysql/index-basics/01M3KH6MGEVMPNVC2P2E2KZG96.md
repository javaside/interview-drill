---
id: 01M3KH6MGEVMPNVC2P2E2KZG96
blockId: mysql/index-basics
relatedBlocks:
  - mysql/mvcc-undo
question: 二级索引查询中的「回表」是什么？
cardType: atomic
appliesTo: MySQL 8.0+
frequency: mid
followUps:
  - 什么情况下可以不回表？
keyPoints:
  - id: kp-lk-1
    text: 二级索引叶子只存主键，需再回聚簇索引取整行的第二次查找
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
---

一句话：**查了两次树**。

你在 name 列上建了索引（**二级索引**），执行 `select * from user where name = '张三'`：

1. 第一查：在 name 的索引树里找到「张三」——但叶子层只存了「张三 + 主键 id=42」，没有年龄、邮箱这些其他列；
2. 第二查：拿 id=42 回到**聚簇索引**（按主键组织的、叶子存整行的那棵主树）再查一次，拿到整行。

这个「回主树取整行」的动作就叫**回表**。它意味着一次查询付出了两棵树的查找成本，命中的行越多，回表代价越大。

<!--advanced-->
回表是二级索引查询的固有成本：secondary B+ 树叶子仅含 (key, pk)，非覆盖查询需以 pk 回聚簇索引完成整行读取，行数多时产生大量随机 IO。优化手段是覆盖索引——把查询所需列全部纳入二级索引，使查询在索引树内闭环，explain 的 Extra 显示 Using index 即未回表。
