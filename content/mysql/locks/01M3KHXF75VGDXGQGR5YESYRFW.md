---
id: 01M3KHXF75VGDXGQGR5YESYRFW
blockId: mysql/locks
relatedBlocks: []
question: 死锁是怎么产生的？InnoDB 怎么处理？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - show engine innodb status 怎么看死锁信息？
keyPoints:
  - id: kp-lk4-1
    text: 两个事务互相持有对方需要的锁，形成循环依赖
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-lk4-2
    text: 死锁检测：发现循环依赖后回滚持锁最少的一方
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-lk4-3
    text: innodb_deadlock_detect=off 时靠锁超时（默认 50s）兜底
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-lk4-4
    text: 预防：事务小而快、按相同顺序访问资源、索引避免无效锁扩大
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'

misconceptions:
  - id: mc-lk4-1
    text: "两个事务同时更新同一行就会死锁，谁也不让谁"
    why: "误解：同一行只会产生排队，后到的事务候着就行；死锁要成环，互相握着对方要的锁才成立"
  - id: mc-lk4-2
    text: "死锁报错说明数据库出了故障，应该先排查版本 bug 而不是改代码"
    why: "误解：死锁是并发的正常副产物，被选中的事务收到 ER_LOCK_DEADLOCK 后重试通常就能过，重点在让事务按固定顺序拿锁"
  - id: mc-lk4-3
    text: "InnoDB 检测到死锁会回滚先启动、持锁时间最长的那个事务"
    why: "误解：挑的是回滚代价最小的一方，即加锁数量最少的事务，不看谁先来谁拿得久"
---

**死锁**=两个事务各拿一把锁、又都想要对方的，谁也不撒手：

```
事务A：锁了行1 → 想要行2（被B拿着）
事务B：锁了行2 → 想要行1（被A拿着）
```

InnoDB **自动检测**等待环，挑一个「回滚代价最小」的（拿锁最少的）干掉，让另一个继续——被回滚的收到 `ER_LOCK_DEADLOCK` 错误。应用侧应**重试**这条事务。

预防三板斧：①事务尽量小、尽快提交（拿锁时间短）②多表/多行按**固定顺序**访问（都先 1 后 2 就不会成环）③SQL 走对索引（索引失效会把锁扩大到全表记录）。

**术语速查**：死锁=循环等待锁｜死锁检测=发现环回滚一方｜等待超时=无检测时的兜底

<!--advanced-->
检测基于 wait-for graph 判环，代价与热点行上的锁等待数相关，高并发同热点场景可关检测用超时+重试。LATEST DETECTED DEADLOCK 段输出两个事务持有的锁与等待的锁。死锁不是错误状态而是正常的并发副产物，应用必须容忍并重试。
