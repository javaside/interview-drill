---
id: 01M3KH6MGE475VCVZGNA0485WR
blockId: mysql/index-basics
relatedBlocks:
  - mysql/mvcc-undo
question: 为什么推荐用自增主键而不是随机主键（如 UUID）？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: mid
followUps:
  - 页分裂具体发生时做了什么？
  - 分布式场景下怎么生成有序 id？
keyPoints:
  - id: kp-inc-1
    text: 自增 id 总是追加到最后：页写满就顺序开新页，避免页分裂
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
  - id: kp-inc-2
    text: 随机主键插入位置随机，触发频繁页分裂与数据搬移，写入变慢
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
  - id: kp-inc-3
    text: 页分裂产生碎片，空间利用率下降
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
  - id: kp-inc-4
    text: 二级索引叶子存主键副本，主键越短二级索引越小
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KH6MGC234VDTZR8CWF8GHZ
      - 01M3KH6MGE6EHRDCH6S3HP1A64
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
      locator: 15.6.2.2
---

聚簇索引（按主键组织的那棵主树）的叶子是**有序**的数据页。新插入一行落在哪里，取决于主键值的大小：

- **自增主键**：新 id 永远比所有现存 id 大 → 新行**总是追加在最右边**的页 → 页写满了就顺序开新页。写入像「在本子最后一页往后写」，又快又整齐。
- **随机主键**（UUID 之类）：插入位置完全随机 → 命中一个已满的页时，InnoDB 得**把这一页劈成两半**、搬移一半数据到新页腾位置——这个动作叫**页分裂（page split）**。像在写满的本子中间硬插一页，还得把后半内容抄过去。

代价有三个：频繁分裂搬移数据（写入变慢）、留下碎片（空间浪费）、UUID 又长（每个**二级索引**的叶子都要存一份主键副本，主键长则所有二级索引都变大）。

**术语速查**：页分裂=满页中间插入被迫劈页搬数据｜碎片=分裂后页内的空闲空洞｜二级索引=其他列的索引树（叶子存主键副本）

<!--advanced-->
B+ 树叶子按键有序，插入位置由键值决定。自增主键保证单调递增，写入集中于最右叶子页，装满即分配新页，顺序 IO 且页内紧凑。随机主键（UUID v4 等）插入点均匀散布，命中满页触发 page split：申请新页、搬移约半数记录、维护页链指针，伴随悲观锁与 redo 量放大；长期随机写入还使页填充率约 50%~70%，缓冲池命中率下降。此外 secondary index 叶子存储主键副本，36 字符 UUID 相对 8 字节 bigint 使每条索引项膨胀约 4 倍。
