---
id: 01M3KJ46DKQ6R6A6MJXTR7Y5CB
blockId: mysql/memory-structures
relatedBlocks: []
question: Double Write（双写缓冲）解决什么问题？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: mid
followUps:
  - redo 不是已经能恢复了吗，为什么还要双写？
keyPoints:
  - id: kp-mem4-1
    text: 问题：宕机时一页只写到一半（部分写失效），redo 重放也要基于完整页
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem4-2
    text: 做法：脏页先顺序写入 doublewrite buffer 共享区，再写各自位置
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem4-3
    text: 恢复：发现页损坏，从双写区取完整副本 + redo 修复
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem4-4
    text: 代价：每页多一次顺序写，可用 innodb_doublewrite 开关控制
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem4-5
    text: 双写区位于共享表空间，顺序写入代价低
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

一个阴险的硬件现实：**宕机时一页 16KB 可能只写进去一半**（页损坏）。而 redo 的重放是「在**完整页**基础上改」——页本身碎了，redo 也没法在碎片上工作。

**双写缓冲**的流程：脏页刷盘前，先把页**顺序写**一份到共享的 doublewrite 区 → 再写到数据文件的真正位置。恢复时发现页损坏 → 从双写区把**完整副本**搬回来 → 再用 redo 补差异。

代价是每页多一次顺序写（便宜），换「页级完整性」的兜底。

**术语速查**：部分写失效=宕机写页写一半｜doublewrite=页的完整备份区

<!--advanced-->
redo 是物理「变更」而非整页镜像，故无法自愈页断裂；双写提供页级原子性兜底（配合 innodb_checksum 检测损坏）。SSD 场景顺序写优势减弱，8.0.30+ 提供 detached/buffer pool instance 变体并可按表空间禁用。
