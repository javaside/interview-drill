---
id: 01M3MFN29Q0JPJG0GVX8C8MEKD
blockId: spring/bean-lifecycle
relatedBlocks:
  - spring/ioc-container
question: Bean 的作用域有哪些？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 单例 Bean 是线程安全的吗？
keyPoints:
  - id: kp-bl2-1
    text: singleton：容器一 Bean（默认）；prototype：每次 getBean 新造
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-bl2-2
    text: request/session：Web 环境，每请求/会话一份
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-bl2-3
    text: application：ServletContext 级；websocket：会话级
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-bl2-4
    text: 注入短周期 Bean 到长周期会失败——需 @Lazy 代理或 ObjectFactory
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-bl2-5
    text: HTTP 作用域依赖请求上下文激活（RequestContextListener 或 DispatcherServlet）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

作用域=「**这份配方造几份**」：

- **singleton**（默认）：容器一**份**——注意**不保证线程安全**（共享可变字段就危险，Spring 管单例不管并发）；
- **prototype**：每次 **getBean 新造**一份（容器不管销毁）；
- **request / session / application / websocket**：Web 场景按请求/会话一份。

经典坑：**singleton 里注入 prototype**——注入只发生一次，短周期 Bean 被「冻」成长期单例。解法：`@Lazy`（注入的是代理，用时再取）或 `ObjectProvider<T>`（用时 getObject）。

**术语速查**：单例=容器一份（不管线程安全）｜prototype=取一次造一次｜注入冻结=短命 Bean 被单例攥住

<!--advanced-->
request/session 作用域靠 ThreadLocal/Session 的 scoped proxy（CGLIB 生成代理桥接到当前上下文实例）。singleton 的并发安全由使用者以无状态/不可变设计保证。web.xml 时代的 RequestContextListener/DispatcherServlet 注册作用域上下文。
