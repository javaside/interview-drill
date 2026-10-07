---
id: 01M3MFN29QXTP76JD3G6EERP34
blockId: spring/bean-lifecycle
relatedBlocks:
  - spring/ioc-container
question: BeanPostProcessor 能干什么？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 自己写 BPP 影响所有 Bean，怎么控制范围？
keyPoints:
  - id: kp-bl3-1
    text: 初始化前后的万能钩子：每个 Bean 实例化流程中都会被调用
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-bl3-2
    text: postProcessBeforeInitialization：@PostConstruct、注解校验
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-bl3-3
    text: postProcessAfterInitialization：AOP 代理生成、@Configuration 增强
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29R5PKX9E9ZPC6XSAPB
      - 01M3MFN29RMZ3AHPVWHKPZHQHZ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-bl3-4
    text: Spring 自身的装配半壁江山都建在 BPP 之上（AutowiredAnnotationBeanPostProcessor）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-bl3-5
    text: BPP 影响容器内全部 Bean，需按类型与注解过滤控制范围
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**BeanPostProcessor = 装配流水线上的定制工位**：每个 Bean 走到初始化**前**和**后**都会过这两个钩子——你要在**不碰目标类**的前提下「加点料」（注入、代理、校验、替换），就插一个 BPP。

Spring 自己就是最大用户：**@Autowired 的填充**（AutowiredAnnotationBeanPostProcessor）、**@PostConstruct**（CommonAnnotationBeanPostProcessor）、**AOP 代理生成**（AbstractAutoProxyCreator）——全是 BPP 干的活。

写自定义 BPP 注意**影响面=全容器 Bean**：要按类型/注解过滤（instanceof/注解检查），只在目标上动手，别的一律原样放行。

**术语速查**：前钩子=初始化前｜后钩子=初始化后（代理在此）｜影响面=全容器

<!--advanced-->
BPP 的注册在普通单例实例化之前完成（registerBeanPostProcessors 先于 finishBeanFactoryInitialization），BPP 自身与它依赖的 Bean 会**提前实例化**（BootstrapAware/容器工厂感知）。InstantiationAwareBeanPostProcessor 扩展到实例化前后（postProcessBeforeInstantiation 是 AOP 的快捷路径、短路构造）与属性填充拦截。
