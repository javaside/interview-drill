---
id: 01M3KHXF756V1EFHHM0T93HBQP
blockId: mysql/log-architecture
relatedBlocks: []
question: "一条 update 从执行到返回，InnoDB 内部完整经过哪些步骤？"
cardType: sequence
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 返回成功时数据真的在磁盘上了吗？
keyPoints:
  - id: kp-log2-1
    order: 1
    text: "第 1 步：定位并加行锁，写 undo log 记录旧值"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-log2-2
    order: 2
    text: "第 2 步：在 buffer pool 中修改数据页成脏页，写 redo 到 log buffer"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-log2-3
    order: 3
    text: "第 3 步：提交时 redo 写盘标记 prepare，写 binlog 并落盘"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-log2-4
    order: 4
    text: "第 4 步：redo 标记 commit，返回客户端成功；脏页由后台异步刷盘"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

按发生**先后**排序（这就是那张经典面试时序图）：

1. **加锁 + 记 undo**：定位目标行加行锁，把旧值抄进 undo log（能回滚）；
2. **改内存页 + 记 redo**：在 buffer pool 里改数据页（成**脏页**），「做了什么」进 redo log buffer（能恢复）；
3. **两阶段提交**：redo 落盘标 **prepare** → 写 **binlog** 并落盘；
4. **收尾**：redo 标 **commit**，向客户端返回成功；脏页由后台**慢慢**刷回磁盘。

注意第 4 步的真相：返回成功时**数据页大概率还在内存**——持久性由已落盘的 redo 保证，不怕断电（重放找回来）。

**术语速查**：脏页=内存已改未刷盘｜prepare/binlog/commit=两阶段提交三拍｜异步刷盘=返回后再落盘

<!--advanced-->
执行链：解析优化→执行器按计划取行→引擎层加锁写 undo→改 BP 页写 redo→server 层写 binlog（两阶段协调）→响应。flush 链表/redo 水位驱动后台刷脏；返回点在 commit 标记后而数据页落盘前后移（WAL 语义），保证 crash-safe 与低延迟并存。
