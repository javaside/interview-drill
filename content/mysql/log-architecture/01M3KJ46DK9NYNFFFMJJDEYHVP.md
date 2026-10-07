---
id: 01M3KJ46DK9NYNFFFMJJDEYHVP
blockId: mysql/log-architecture
relatedBlocks: []
question: 崩溃恢复（crash recovery）的完整流程是什么？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 为什么敢把未提交事务的页修改也重放？
keyPoints:
  - id: kp-log4-1
    text: 从 checkpoint LSN 起重放 redo（含未提交事务的页修改）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75A058357P4PBBKMCG
      - 01M3KHXF75MB2TSZ8Z02239NXG
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-log4-2
    text: 找出处于 prepare 且 binlog 完整的事务 → 提交
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75BZGZ60GV618ERYXY
      - 01M3NCQ6WZ2YRJHBP2A6CJ4W7R
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-log4-3
    text: binlog 不完整或压根没到 prepare 的 → 按 undo 回滚
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M2YHWH5R70FFC6TGAN0VP7ZS
      - 01M3KHXF75A058357P4PBBKMCG
      - 01M3KHXF75BZGZ60GV618ERYXY
      - 01M3NCQ6WZ2YRJHBP2A6CJ4W7R
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-log4-4
    text: 恢复时页 LSN 已够新的直接跳过，重复执行也安全
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75MB2TSZ8Z02239NXG
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

数据库重启后的**自我修复**流程：

1. **重放 redo**：从 checkpoint 起把之后的日志全部重放——注意是**全部**，包括「当时还没提交」的事务的页修改（先恢复到崩溃前的物理现场，提交与否下一步裁定；页上 LSN 已够新的自动跳过，幂等）；
2. **裁定两阶段**：发现 **prepare** 状态的事务 → 查 **binlog**：完整 → **提交**；不完整/缺失 → **回滚**；
3. **undo 清尾**：未提交/裁定回滚的事务，按 undo log 把页改回去；
4. 恢复完成，对外服务。

一句话：**redo 先把世界拼回崩溃瞬间，再按两阶段的证据决定谁活谁死。**

**术语速查**：重放=按日志重做｜幂等=重复执行结果不变｜裁定=以 binlog 完整性定提交或回滚

<!--advanced-->
物理现场先行（重放全量含未提交）是 redo 物理日志设计使然：undo 段本身亦以页形式存在，需先经 redo 恢复才可读。两阶段裁定的正确性依赖 binlog 落盘时机（双 1 语义）；非双 1 配置对应放宽边界而非取消恢复。
