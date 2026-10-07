---
id: 01M3KJ46DK0JQ1P2RWCWSHCSC1
blockId: mysql/redo-log
relatedBlocks: []
question: LSN 是什么？
cardType: atomic
appliesTo: MySQL 8.0+
frequency: mid
followUps:
  - 恢复时 LSN 怎么用？
keyPoints:
  - id: kp-rd5-1
    text: 单调递增的全局字节偏移，标记 redo 进度与数据页新旧程度
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

**LSN（Log Sequence Number）**= 一把**全局进度尺**：redo log 从头到尾的字节偏移，单调递增。

它同时标记三件事：redo **写到了哪**（log flushed LSN）、checkpoint **推进到哪**、每个数据页**新到什么程度**（页头记着最后一次修改它的 LSN）。崩溃恢复就是拿尺子量：**checkpoint 之后的日志**重放一遍——页上 LSN ≥ 日志 LSN 的跳过（已够新），小于的才补。

**术语速查**：LSN=redo 的全局字节进度号｜checkpoint LSN=恢复起点

<!--advanced-->
比较 (page_lsn, redo_lsn) 决定是否重放该条（幂等加速）。flushed_up_to/checkpoint_age 驱动刷脏与 IO 限速；binlog 亦有自己的位点体系（file:pos/GTID），与 LSN 属两套坐标。
