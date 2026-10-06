---
id: 01M3KJ46DKA96Z7J019CVJXCAY
blockId: mysql/redo-log
relatedBlocks: []
question: 什么是脏页？哪些情况会触发刷脏页？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 刷脏抖动为什么会引起业务卡顿？
keyPoints:
  - id: kp-rd4-1
    text: 脏页=buffer pool 中已修改但未刷回磁盘的数据页
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd4-2
    text: redo log 写满逼近：checkpoint 强制推进，刷最老脏页腾日志空间
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd4-3
    text: 内存不足淘汰页：LRU 逐出的页若是脏页必须先刷
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd4-4
    text: 正常后台节奏刷脏 + shutdown 时全量刷
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

**脏页**：内存里改了、还没写回磁盘的数据页（改完不是立刻写盘——WAL 已保证了安全，可以攒着批量写）。

什么时候必须刷：

1. **redo 快写满**（最被动）：循环日志逼近起点 → 强制 checkpoint → 突击刷最老的脏页，此时**写入被卡住**（日志不能推进）——业务顿挫感多源于此；
2. **内存不够**：LRU 淘汰某页时它是脏的 → 先刷再逐出；
3. **后台平时慢慢刷**（page cleaner 按脏页比例/redo 水位控制速率）＋**关库时**全部刷净。

**术语速查**：脏页=内存改了未落盘｜刷脏=把脏页写回磁盘｜checkpoint=推进日志起点的强制动作

<!--advanced-->
redo 空间不足引发的同步刷脏会造成写入毛刺（log free wait）。8.0 的 page cleaner 自适应刷脏速率与脏页比例（innodb_max_dirty_pages_pct）联动；关库默认 sharp checkpoint 全量刷（innodb_fast_shutdown=1 除外仅刷 + 增量）。
