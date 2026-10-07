---
id: 01M3MFN29RMTFSJACBA35694TQ
blockId: spring/aop
relatedBlocks: []
question: AOP 的核心术语？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - Spring AOP 和 AspectJ 的区别？
keyPoints:
  - id: kp-aop1-1
    text: 切面 Aspect=切点+通知的模块；连接点=可织入的方法执行点
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29RMZ3AHPVWHKPZHQHZ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-aop1-2
    text: 切点 Pointcut=哪些方法（表达式筛选连接点）；通知 Advice=织入干什么
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29RMZ3AHPVWHKPZHQHZ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-aop1-3
    text: 五种通知：@Before/@After/@AfterReturning/@AfterThrowing/@Around
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-aop1-4
    text: 织入 Weaving=把切面套到目标上——Spring 是运行时代理织入
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29R5PKX9E9ZPC6XSAPB
      - 01M3MFN29R5VT9N1MBAMEP1Q8E
      - 01M3MFN29RMZ3AHPVWHKPZHQHZ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

一套「**在哪（切点）干什么（通知）**」的词汇表：

- **Aspect（切面）**：一个横切关注点的完整模块（=日志切面/事务切面）；
- **JoinPoint（连接点）**：程序里**可以**下钩的位置（Spring 里=方法执行）；
- **Pointcut（切点）**：用表达式（`execution(* com.x.service.*.*(..))`）从万千连接点里**筛出目标**；
- **Advice（通知）**：筛出来之后**干什么、什么时机**——前置/后置/返回后/异常后/环绕五档；
- **Weaving（织入）**：把切面装到目标上——Spring 选的是**运行时代理**。

**术语速查**：切点=在哪｜通知=何时干什么｜环绕=包圆整个执行的钩子

<!--advanced-->
Spring AOP 是代理实现（只支持方法织入、只拦 Spring Bean）；AspectJ 是编译/加载期字节级织入（字段/构造器/任意类）。引入 Introduction（@DeclareParents）与 @Order 的链序。
