---
id: 01M3MFN29R5PKX9E9ZPC6XSAPB
blockId: spring/aop
relatedBlocks: []
question: Spring AOP 的实现原理？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 代理是什么时候生成的？
keyPoints:
  - id: kp-aop2-1
    text: 运行时动态代理：接口走 JDK 代理，无接口走 CGLIB 子类化
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29R50DZHWB1PETZVT4Z
      - 01M3MFN29RJHQASHN5D8GS4XSV
      - 01M3MFN29RMZ3AHPVWHKPZHQHZ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-aop2-2
    text: AbstractAutoProxyCreator（BPP）在初始化后判定切点命中则生成代理
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29QXTP76JD3G6EERP34
      - 01M3MFN29RMZ3AHPVWHKPZHQHZ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-aop2-3
    text: 代理拦截方法调用：按序执行拦截器链（各通知转成的 MethodInterceptor）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29R5VT9N1MBAMEP1Q8E
      - 01M3MFN29RMZ3AHPVWHKPZHQHZ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-aop2-4
    text: Boot 2+ 默认 proxyTargetClass=true（全 CGLIB）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29RJHQASHN5D8GS4XSV
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
misconceptions:
  - id: mc-aop2-1
    text: "Spring AOP 靠类加载期改写目标类字节码把切面织入，与 AspectJ 用同一套织入机制"
    why: "误解：Spring AOP 是运行时动态代理，容器里存代理对象、目标类字节码原封不动；编译/加载期织入是 AspectJ 自带的机制"
  - id: mc-aop2-2
    text: "JDK 动态代理靠继承目标类生成子类实现拦截，所以要求目标类可被继承"
    why: "误解：方向反了——JDK 代理生成的类只实现目标接口并把调用转发给 InvocationHandler；生成子类是 CGLIB 的路数"
  - id: mc-aop2-3
    text: "代理对象在 Bean 实例化的同时同步生成，构造器一跑完拦截器链就位"
    why: "误解：代理要包装配完成的成品，后置处理器在初始化之后的钩子里才判定切点命中并生成代理"
---

**Spring AOP = Bean 生命周期里的一次「偷梁换柱」**：

1. **时机**：Bean 走完初始化 → `AbstractAutoProxyCreator`（它是个 BeanPostProcessor）在**初始化后钩子**里问一句：这 Bean 的方法**有切点命中吗**？
2. **生成**：命中 → 生成代理——目标有接口走 **JDK 动态代理**（实现接口转发 InvocationHandler），没有走 **CGLIB**（生成子类覆盖方法）。容器里放的从此是**代理**；
3. **运行**：调代理的方法 → 拦截器链（每个通知已适配成 MethodInterceptor）按 **Around→Before→目标→AfterReturning/AfterThrowing→After** 顺序执行。

**术语速查**：初始化后生成=代理包的是成品｜拦截器链=通知的执行队列｜偷梁换柱=容器存的是代理

<!--advanced-->
AnnotationAwareAspectJAutoProxyCreator 解析 @Aspect（反射提取 @Around 们建 advisor 链）；AopUtils.canApply 的切点匹配。代理创建后 cache（advisedBeans 标记）。ExposeInvocationInterceptor 处理链上下文。
