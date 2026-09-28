---
id: 01M3MFN29RD2NVBJQYQFZNV35F
blockId: spring/transaction-tx
relatedBlocks:
  []
question: "@Transactional 什么时候会失效？"
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 为什么默认只回滚 RuntimeException？
keyPoints:
  - id: kp-tx2-1
    text: "同类自调用：this 不走代理，事务拦截器根本没机会执行"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-tx2-2
    text: "方法非 public（CGLIB/代理拦截不到）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-tx2-3
    text: "异常被 catch 吞掉，或抛的是受检异常而未配 rollbackFor"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-tx2-4
    text: "类不是 Spring Bean（自己 new 的）；或引擎不支持（MyISAM）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-tx2-5
    text: "多线程里调用：事务绑定 ThreadLocal 连接，子线程无事务"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
---

**失效八宗罪**（高频考题，按踩坑率排）：

1. **同类自调用**——this 裸奔不过代理（见 AOP 块）；
2. **非 public 方法**——代理拦不到；
3. **异常被 catch 吞了**——拦截器没看到异常，正常提交；
4. **抛受检异常没配 rollbackFor**——默认只回滚 **RuntimeException/Error**（EJB 的历史约定）：`@Transactional(rollbackFor = Exception.class)` 显式放宽；
5. 自己 **new 的对象**（不是容器 Bean）——没代理；
6. 存储引擎不支持（MyISAM 无事务）；
7. **子线程/异步**调用——事务上下文是 **ThreadLocal 绑定**的连接，新线程拿不到；
8. 传播行为配置反了（NOT_SUPPORTED 里谈何事务）。

**术语速查**：ThreadLocal 绑定=事务跟着线程走｜rollbackFor=放宽回滚范围｜吞异常=拦截器失明

<!--advanced-->
事务同步（TransactionSynchronizationManager）的 ThreadLocal 集（连接/同步器）；跨线程需 TransactionTemplate 手动或spring 的 @Transactional 与 executor 包装。rollbackOnly 已标记后正常返回触发 UnexpectedRollbackException。
