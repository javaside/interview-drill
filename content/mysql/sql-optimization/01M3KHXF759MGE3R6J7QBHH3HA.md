---
id: 01M3KHXF759MGE3R6J7QBHH3HA
blockId: mysql/sql-optimization
relatedBlocks: []
question: type 列从好到差的顺序和含义？
cardType: sequence
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 为什么 index 比 ALL 略好但通常还是该优化？
keyPoints:
  - id: kp-opt2-1
    order: 1
    text: const：主键或唯一索引按唯一值命中，最多一行
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt2-2
    order: 2
    text: eq_ref：join 时被驱动表走主键/唯一索引，每外层行最多一行
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt2-3
    order: 3
    text: ref：普通索引按值匹配，可多行
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt2-4
    order: 4
    text: range：索引范围扫描（between、>、in）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KH6MGC234VDTZR8CWF8GHZ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt2-5
    order: 5
    text: index：扫整棵索引树（比 ALL 好：索引比数据小，仍是全扫）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt2-6
    order: 6
    text: ALL：全表扫描，每行都读
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

访问类型的**好坏阶梯**（把下面从「最好」排到「最差」）：

const（主键等值一发命中）→ eq_ref（join 对面走唯一索引）→ ref（普通索引等值）→ range（索引范围）→ index（全索引树扫描）→ ALL（全表扫描）。

规律：**越靠前读的行越少**。const/ref 只摸几行；range 摸一段；index/ALL 是「全都要过一遍」——index 稍好（索引树比整表瘦、且有序），本质仍是全扫，行数大时一样慢。

**术语速查**：const=唯一等值单行｜eq_ref=join 唯一命中｜ref=普通索引等值｜range=范围｜index=全索引扫｜ALL=全表扫

<!--advanced-->
system 为 const 的特例（单行表）。index 与 ALL 的成本差在于索引页更少且可能覆盖所需列（免回表）。实践红线：互联网高并发表出现 range 以下（index/ALL）即需审视谓词与索引匹配度。
