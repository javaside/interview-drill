---
id: 01M3MFN29RA2VYVPGFFZ9C1YN4
blockId: spring/transaction-tx
relatedBlocks:
  []
question: "事务隔离级别在 Spring 里怎么配？"
cardType: enumeration
appliesTo: Spring 6+
frequency: low
followUps:
  - readonly=true 是什么作用？
keyPoints:
  - id: kp-tx5-1
    text: "@Transactional(isolation=...)：DEFAULT/READ_UNCOMMITTED/READ_COMMITTED/REPEATABLE_READ/SERIALIZABLE"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-tx5-2
    text: "DEFAULT 跟随数据源默认（MySQL 是 RR）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-tx5-3
    text: "Spring 只是传递者：隔离最终由 JDBC Connection.setTransactionIsolation 落实"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-tx5-4
    text: "方法级注解覆盖类级；与传播行为组合决定实际连接行为"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
---

Spring 的隔离配置是**转发**：注解里的 isolation 最终通过 `Connection.setTransactionIsolation()` 传给数据库——语义与隔离级别表完全一致（脏读/不可重复读/幻读的取舍，见 MySQL 事务块）。**DEFAULT** = 跟数据源默认走（MySQL RR、PG RC）。

**`readOnly=true`** 的三层含义：①驱动提示（MySQL 只读优化路由）；②Hibernate FlushMode.MANUAL（免脏检查）；③框架/业务侧语义声明（可读性）。注意它**不阻止**你在事务里写——只是约定与优化信号。

**术语速查**：DEFAULT=随库默认｜readonly=优化与语义提示非强制锁

<!--advanced-->
全局设置（application.yml 的 spring.transaction.default-timeout/isolation）与注解覆盖优先级。隔离与传播的组合坑：REQUIRES_NEW 内改隔离要拿**新连接**（同连接改隔离会污染挂起的外层）。
