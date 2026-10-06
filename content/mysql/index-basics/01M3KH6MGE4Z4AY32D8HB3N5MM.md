---
id: 01M3KH6MGE4Z4AY32D8HB3N5MM
blockId: mysql/index-basics
relatedBlocks:
  - mysql/mvcc-undo
question: 哪些常见写法会导致索引失效？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 为什么函数包裹就不走索引？
  - 最左前缀的底层原因是什么？
keyPoints:
  - id: kp-inv-1
    text: 对索引列使用函数或表达式：where year(create_time) = 2026
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
  - id: kp-inv-2
    text: 隐式类型转换：字符串列传入了数字
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
  - id: kp-inv-3
    text: 前导模糊匹配：like '%xx'（'xx%' 则可用）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
  - id: kp-inv-4
    text: 联合索引不满足最左前缀：跳过第一列直接查后面的列
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
---

索引是按**列的原值**有序组织的。写法一旦让数据库「没法直接按有序值找」，就只能放弃索引、全表逐行扫（**索引失效**→**全表扫描**）。四种最常见的踩法：

1. **函数/表达式包裹索引列**：`where year(create_time) = 2026`——索引存的是原始时间值，按「年份」找没有序可用，只能每行算一遍 year()。把条件改写成 `create_time >= '2026-01-01' and create_time < '2027-01-01'` 就能走索引。
2. **隐式类型转换**：phone 是字符串列，你写 `where phone = 13800000000`（数字）——MySQL 会把**每行的 phone 转成数字**再比，等于对列套了函数，失效。传 `'13800000000'`（字符串）就好。
3. **前导模糊**：`like '%abc'`——以通配符开头，无法利用有序性定位；`like 'abc%'`（后缀通配）可以。
4. **不满足最左前缀**：联合索引 (a, b, c) 像「先按 a 排、a 相同再按 b 排」的电话本——跳过 a 直接查 b/c，序就用不上了。`where b = 1` 失效；`where a = 1 and b = 2` 有效。

**术语速查**：索引失效=写法使数据库放弃走索引｜全表扫描=逐行读整表｜隐式类型转换=MySQL 自动做的类型变换（方向决定加函数的是哪边）｜最左前缀=联合索引的排序优先级规则

<!--advanced-->
失效的统一原理是「谓词无法转化为索引序上的区间定位」：函数/运算/类型转换破坏了与键序的可比性；前导通配符使前缀未知；联合索引 (a,b,c) 的序是字典序，跳过 a 则 b/c 局部无序。优化器在代价估计后放弃 range/ref 而选择全表扫描。规避：谓词改写为 sargable 形式、字面量与列类型对齐、模糊限定后缀、查询列覆盖最左前缀。可用 explain 的 type=ALL 与 Extra=Using where 佐证。
