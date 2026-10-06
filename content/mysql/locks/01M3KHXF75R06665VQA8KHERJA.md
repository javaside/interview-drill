---
id: 01M3KHXF75R06665VQA8KHERJA
blockId: mysql/locks
relatedBlocks: []
question: 什么是插入意向锁？
cardType: atomic
appliesTo: MySQL 8.0+
frequency: low
followUps:
  - 它和间隙锁的冲突关系是什么？
keyPoints:
  - id: kp-lk5-1
    text: 插行前对间隙的意向标记：彼此兼容、仅与间隙锁冲突
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

往一个**间隙**里插行之前，事务会先挂一个「**插入意向锁**」——意思是「我打算在这个缝里插一行」。

它的妙处：**多个事务可以同时在同一个缝的不同位置插入**（插 id=12 和 id=15 互不妨碍）；它只跟一样东西冲突——别人在缝上挂的**间隙锁**。间隙锁说「这缝不让插」，插入意向锁说「我要插这缝」，两者相遇才等待。

**术语速查**：插入意向锁=插行前对缝的意向声明，彼此兼容、仅与间隙锁冲突

<!--advanced-->
insert intention lock 属间隙范围意向而非严格互斥锁，兼容矩阵上 II 锁之间兼容、与 gap/next-key 锁冲突。它使「间隙内不同键位的插入」无需互相排队，显著提高并发插入吞吐。
