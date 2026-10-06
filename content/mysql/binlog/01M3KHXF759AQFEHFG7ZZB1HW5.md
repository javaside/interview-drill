---
id: 01M3KHXF759AQFEHFG7ZZB1HW5
blockId: mysql/binlog
relatedBlocks: []
question: binlog 有哪三种格式？各有什么优缺点？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 为什么 RR 下 statement 才安全？
keyPoints:
  - id: kp-bi-1
    text: statement：记 SQL 原文，量小；但 now()/uuid() 这类不确定函数主从可能不一致
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi-2
    text: row：记每行改动的前后镜像，绝对一致；日志量大
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi-3
    text: mixed：默认 statement，检测到不安全语句自动切 row
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi-4
    text: binlog 是 Server 层日志，所有引擎都有；redo 是 InnoDB 引擎层特有
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

**binlog**（归档日志）给**备份数据恢复和主从复制**用：主库把每次修改记下来，从库照着重放。记的格式有三种：

- **statement**：记 SQL 原文（`update t set x=1 where ...`）。省空间；但含 `now()`、`uuid()`、`limit`（无 order by）这类**不确定**语句时，主从执行结果可能不同 → 数据漂移。
- **row**：记**每一行的前后值**（改了 id=42 的 x 从 5 到 1）。从库直接对号入座，绝对一致；代价是批量 update 十万行就记二十万行镜像，日志巨大。
- **mixed**：平时 statement，遇到不安全语句自动换 row。折中方案。

**术语速查**：binlog=Server 层归档日志｜statement=记语句｜row=记行镜像｜复制=从库重放主库日志

<!--advanced-->
row 格式含 before/after image（可配 binlog_row_image），支持幂等重放与 flashback。statement 的确定性边界：函数、触发器、自增插入序等；RR 的固定 ReadView 保证 statement 下备库重放读到与主库相同快照，这是历史默认 RR 的成因之一。8.0 默认 row。
