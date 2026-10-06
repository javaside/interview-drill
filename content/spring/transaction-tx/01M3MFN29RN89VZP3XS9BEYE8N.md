---
id: 01M3MFN29RN89VZP3XS9BEYE8N
blockId: spring/transaction-tx
relatedBlocks: []
question: '@Transactional 的传播行为有哪些？'
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - REQUIRED 和 NESTED 的区别？
keyPoints:
  - id: kp-tx1-1
    text: REQUIRED（默认）：有事务加入，没有就新建
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-tx1-2
    text: REQUIRES_NEW：挂起当前事务，另起独立新事务
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-tx1-3
    text: NESTED：嵌套事务（savepoint），外层回滚带动内层
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-tx1-4
    text: SUPPORTS 有则加入无则非事务；MANDATORY 必须有否则异常；NEVER 相反
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-tx1-5
    text: NOT_SUPPORTED：挂起事务以非事务方式执行
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**传播行为**=「方法被调用时，事务怎么接续」。高频四档：

- **REQUIRED**（默认）：**有就加入，没有就开**——绝大多数场景的正确答案（内外同一事务，内层抛错外层标记回滚）；
- **REQUIRES_NEW**：**另起炉灶**——挂起外层事务，开一个**全新独立**事务（内层提交不裹挟外层，如「日志必须落库」场景：主流程回滚，日志照写）；
- **NESTED**：**存档点**（savepoint）——内层是外层的**嵌套**事务：内层可单独回滚到存档点，但**外层回滚必带内层**（外层是内层的父集）；
- 其余三档：**SUPPORTS**（随缘）、**MANDATORY**（必须在事务里否则异常）、**NEVER/NOT_SUPPORTED**（拒绝/挂起事务）。

**术语速查**：加入=同一事务｜另起炉灶=REQUIRES_NEW 独立提交回滚｜存档点=NESTED 局部回滚

<!--advanced-->
REQUIRES_NEW 的两连接问题（内层拿新连接，外层连接被挂起仍持有——连接池耗尽风险）。NESTED 依赖 JDBC savepoint（DataSourceTransactionManager 支持，JTA 不支持）。rollbackOnly 标记在同 REQUIRED 事务中的传播语义（UnexpectedRollbackException 的来源）。
