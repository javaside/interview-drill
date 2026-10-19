---
id: 01M3KH6MGC234VDTZR8CWF8GHZ
blockId: mysql/index-basics
relatedBlocks:
  - mysql/mvcc-undo
question: B+ 树索引有哪些特点？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - B+ 树和 B 树的区别是什么？
  - 一页 16KB 能放多少个键？
keyPoints:
  - id: kp-bpt-1
    text: 非叶子节点只存键不存数据，一页能容纳更多键，树更矮
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
  - id: kp-bpt-2
    text: 叶子节点存全部键与数据，且按键有序、用链表串联
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KH6MGE6EHRDCH6S3HP1A64
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
  - id: kp-bpt-3
    text: 树矮意味着查一行经过的节点少，磁盘 IO 次数少
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
  - id: kp-bpt-4
    text: 范围查询可沿叶子层链表顺序扫描，不必回树上多次查找
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2

misconceptions:
  - id: mc-bpt-1
    text: "B+ 树的非叶子节点也存放一部分行数据，只是比叶子层存得少"
    why: "误解：非叶子节点只存键和子指针，数据全部沉到叶子层，这是它扇出比 B 树大、树更矮的根基"
  - id: mc-bpt-2
    text: "哈希索引 O(1) 必然快过 B+ 树的 O(log n)，InnoDB 的主索引理应换成哈希"
    why: "误解：哈希打不了范围和排序，也用不上最左前缀，B+ 树用树高换来有序结构，一次点查也就三四个页访问"
  - id: mc-bpt-3
    text: "千万行级别的表 B+ 树会长到几十层，所以必须控制单表数据量"
    why: "误解：16KB 一页扇出极大，千万行通常三到四层就够，树高按对数增长，几十层的说法不成立"
---

先想一个问题：数据在磁盘上，读一次磁盘比读内存慢几万倍，怎么让查询**少读几次磁盘**？答案是把索引做成一棵矮胖的树——**B+ 树**。

它的三个特点（**索引（B+ 树）**=一本多级目录）：

1. **非叶子节点只存键（目录页）**：中间节点不存数据只存「键 + 指向下一层的指针」。一页磁盘（默认 16KB）能塞下成百上千个目录项，树被压得很矮——千万行的表通常只要 3~4 层，也就是查一行最多 3~4 次磁盘 IO。
2. **叶子节点存数据且有序成链（正文页）**：全部真实数据在叶子层，按键**有序**排列，且叶子之间用**链表**串起来。
3. **范围查询顺着链走**：查「id 在 100 到 500 之间」，定位到 100 后沿链表顺序往后扫就行，不用反复从树顶往下找。

**术语速查**：B+ 树=多级目录式的索引结构｜非叶子节点=目录页｜叶子节点=数据页｜磁盘 IO=读一次磁盘页｜范围查询=按区间取多行

<!--advanced-->
B+ 树是为磁盘优化的多路平衡搜索树：非叶节点仅存键与子指针使扇出极大（16KB 页可容纳约 1200 个指针），三层即可索引约两千万行；叶子层持有全部键值与行数据（聚簇形态）或主键（二级形态），并以双向链表串联，范围扫描退化为叶子层的顺序遍历。对比 B 树（数据分布在所有节点、无叶子链表），B+ 树以「中间节点瘦身 + 叶子成链」同时优化了点查高度与范围扫描。
