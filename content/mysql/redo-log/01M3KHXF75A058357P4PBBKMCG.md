---
id: 01M3KHXF75A058357P4PBBKMCG
blockId: mysql/redo-log
relatedBlocks: []
question: redo log 和 undo log 的区别？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: mid
followUps:
  - 为什么 undo 也要 redo 保护？
keyPoints:
  - id: kp-rd3-1
    text: redo 记「做了什么」用于重放（保持久性）；undo 记「改前是什么」用于回滚（保原子性）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M2YHWH5R70FFC6TGAN0VP7ZS
      - 01M3KHXF73KZ58QW2B9NJA32E1
      - 01M3KHXF75MB2TSZ8Z02239NXG
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd3-2
    text: redo 物理页级日志循环写；undo 逻辑日志按段管理、随 purge 清理
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd3-3
    text: 崩溃恢复：未提交事务按 undo 回滚，已提交按 redo 重放
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M2YHWH5R70FFC6TGAN0VP7ZS
      - 01M3KHXF73KZ58QW2B9NJA32E1
      - 01M3KHXF75MB2TSZ8Z02239NXG
      - 01M3KJ46DK9NYNFFFMJJDEYHVP
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-rd3-4
    text: undo 本身的修改也受 redo 保护
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KJ46DK9NYNFFFMJJDEYHVP
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

两本账，方向相反：

- **redo（重做）**：记「**做了什么**」——崩溃后照账**重做**一遍找回来。保**持久性**（提交了就不丢）。
- **undo（撤销）**：记「**改之前是什么**」——反悔或崩溃时照账**改回去**。保**原子性**（要么全做要么全不做）。

崩溃恢复时两本配合：**已提交**的事务按 redo 重放（可能数据页还没刷）；**没提交**的事务按 undo 回滚（可能改了一半）。

细节：redo 是**物理**日志（页级改动）循环写；undo 是**逻辑**日志（反向 SQL 语义）独立段管理、被 MVCC 引用着不能乱删。undo 页自己的修改也要记 redo——不然断电连「怎么撤销」都忘了。

**术语速查**：redo=重放账（持久性）｜undo=撤销账（原子性）｜物理日志=页级改动｜逻辑日志=操作语义

<!--advanced-->
redo 物理格式为 (space, page, offset) 变更；undo 为逻辑回滚段（rollback segment）内的 undo rec，insert undo 提交即可释放、update undo 待 purge。恢复流程：扫描 redo 至 checkpoint LSN 重放全部，再依 undo 回滚未提交事务（崩溃一致性双保险）。
