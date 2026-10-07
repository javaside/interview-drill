---
id: 01M3KHXF757BNWY0QZB1D030EG
blockId: mysql/transactions
relatedBlocks: []
question: SAVEPOINT 是干什么的？
cardType: atomic
appliesTo: MySQL 8.0+
frequency: low
followUps:
  - 保存点之后的保存点回滚后会怎样？
keyPoints:
  - id: kp-tac-4-1
    text: 在事务内设置保存点，ROLLBACK TO 可只撤销保存点之后的操作而不放弃整个事务
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M2YHWH5R70FFC6TGAN0VP7ZS
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

事务很长、做到一半某步失败了，不想全部重来——**SAVEPOINT** 就是游戏里的「存档点」：

```sql
BEGIN;
UPDATE A;         -- 成功
SAVEPOINT sp1;    -- 存档
UPDATE B;         -- 失败了
ROLLBACK TO sp1;  -- 只撤销 B，A 保留，事务继续
COMMIT;           -- 最终只提交 A
```

**术语速查**：SAVEPOINT=事务内存档点｜ROLLBACK TO=回档不退出事务

<!--advanced-->
SAVEPOINT 名称可复用（同名覆盖）。ROLLBACK TO 撤销其后所有保存点。保存点不释放锁与 undo，事务整体仍持锁直至 COMMIT/ROLLBACK。MySQL 对标准语法扩展了同名覆盖语义。
