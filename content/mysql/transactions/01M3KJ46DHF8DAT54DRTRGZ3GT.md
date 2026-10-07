---
id: 01M3KJ46DHF8DAT54DRTRGZ3GT
blockId: mysql/transactions
relatedBlocks: []
question: 事务里执行 DDL 有什么风险？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: mid
followUps:
  - 隐式提交都有哪些语句？
keyPoints:
  - id: kp-tac5-1
    text: 多数 DDL 会造成隐式提交：当前事务先被悄悄提交
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75Y7X2477T9CVCV22J
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-tac5-2
    text: DDL 失败回滚不影响已被隐式提交的前序事务
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-tac5-3
    text: DDL 是表级操作，可能与行锁、复制产生长时间阻塞
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-tac5-4
    text: 8.0 的原子 DDL 把 DDL 本身做成原子的，但仍无法回到之前的事务
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-tac5-5
    text: 批量 DML 与 DDL 混排在复制下产生不确定顺序，主从易漂移
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

**DDL**（建表/改表结构这类）在事务里是「不速之客」：

1. **隐式提交**：多数 DDL 执行前会把你**当前事务悄悄提交掉**（哪怕你本想继续）；
2. 提交了就回不去了：DDL 失败也不会**恢复**前面的事务——你的 DML 已经生效；
3. DDL 是表级操作，等所有行操作结束、拿表锁，大表上可能**阻塞很久**并传染给复制。

所以惯例：**事务只放 DML**，DDL 单独执行。

**术语速查**：隐式提交=DDL 前自动 commit 当前事务｜原子 DDL=DDL 自身要么全成功要么全无

<!--advanced-->
隐式提交语句清单含 DDL、ALTER、及部分管理语句。8.0 引入原子 DDL（数据字典事务化，DDL 自身可回滚），但隐式提交语义不变。在线 DDL（ALGORITHM=INPLACE/INSTANT）降低锁影响，仍属会话级独立操作单元。
