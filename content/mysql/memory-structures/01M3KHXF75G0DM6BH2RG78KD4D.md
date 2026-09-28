---
id: 01M3KHXF75G0DM6BH2RG78KD4D
blockId: mysql/memory-structures
relatedBlocks: []
question: "Change Buffer 是什么？什么时候失效？"
cardType: atomic
appliesTo: MySQL 8.0+
frequency: mid
followUps:
  - 为什么唯一索引用不了 change buffer？
keyPoints:
  - id: kp-mem3-1
    text: "对唯一二级索引的 DML 先缓存进 change buffer 免立刻读盘，后续读取或 merge 时合并"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem3-2
    text: "写多读少且索引页常不在缓存的负载收益最大"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

给**非唯一**二级索引插入一条记录，目标索引页可能不在缓存里——立刻读盘就为插一条，太亏。**Change Buffer**：先把这个改动**缓存在内存**，等那页因为别的原因被读进缓存（或后台 merge）时再**合并**进去。

限制：**唯一索引用不了**——插入前必须读页验证唯一性，绕不开读盘，缓存就没意义了。所以自增主键+普通二级索引的组合最受益（配合主键永远追加写）。

**术语速查**：change buffer=二级索引改动的暂存区｜merge=暂存改动合并回索引页

<!--advanced-->
change buffer 是 BP 内的 B+ 结构（innodb_change_buffering 控制 insert/delete/purge 策略），写放大与读放大双赢于写多读少、页不在缓存的负载。唯一索引需读取页做唯一性校验故不适用。8.0.30 起默认 all。
