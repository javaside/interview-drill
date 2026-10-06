---
id: 01M3MFN29RMZ3AHPVWHKPZHQHZ
blockId: spring/transaction-tx
relatedBlocks: []
question: 声明式事务的实现原理？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 事务拦截器在拦截器链的哪个位置？
keyPoints:
  - id: kp-tx3-1
    text: AOP 环绕通知：TransactionInterceptor 拦截 @Transactional 方法
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-tx3-2
    text: 事务管理器 PlatformTransactionManager 按 propagation 开/接事务
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-tx3-3
    text: 连接绑定 ThreadLocal：同线程内 DAO 拿到同一事务连接
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-tx3-4
    text: 正常返回 commit，异常按 rollbackFor 决定回滚
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**@Transactional = 一个注解 + 一套 AOP 流水线**：

1. 开机时 `@EnableTransactionManagement` 注册切面（InfrastructureAdvisorAutoProxyCreator + TransactionInterceptor）；
2. 调用被代理拦下 → **TransactionInterceptor**（环绕通知）：查方法的 @Transactional 属性 → 问 **PlatformTransactionManager**（对 JDBC 就是 DataSourceTransactionManager）：**按传播行为**开新事务/加入现有（`getTransaction`）；
3. 拿到的** Connection 绑进 ThreadLocal**（TransactionSynchronizationManager）——同线程里 MyBatis/JdbcTemplate 都从这里取连接 → **同一个事务**；
4. 方法正常返回 → **commit**；抛异常 → 按规则 **rollback**；善后解绑。

**术语速查**：环绕通知=包住方法的一层｜事务管理器=开/提交/回滚的策略中枢｜连接绑定=ThreadLocal 发同一张牌

<!--advanced-->
TransactionAttributeSource 解析注解属性（含方法级覆盖类级）；事务在拦截器链的顺序由 @Order(Ordered.LOWEST_PRECEDENCE) 可调。AbstractPlatformTransactionManager 的 doBegin/doCommit/doRollback 钩子族（JPA/JTA 各自实现）。隔离级别与 timeout 属性同样经 TransactionDefinition 传递。
