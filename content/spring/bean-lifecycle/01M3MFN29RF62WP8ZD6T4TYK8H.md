---
id: 01M3MFN29RF62WP8ZD6T4TYK8H
blockId: spring/bean-lifecycle
relatedBlocks:
  - spring/ioc-container
question: Spring 怎么解决循环依赖？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 为什么需要第三级缓存存工厂？
keyPoints:
  - id: kp-bl5-1
    text: 三级缓存：单例池 / 早期工厂池 / 原始对象池
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-bl5-2
    text: singletonObjects：成品；earlySingletonObjects：半成品；singletonFactories：提前暴露的工厂
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-bl5-3
    text: A 实例化后先把工厂放三级缓存，B 要 A 时从工厂拿早期引用
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-bl5-4
    text: 只解 setter/字段注入的单例循环；构造器循环与 prototype 直接失败
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-bl5-5
    text: 第三级存工厂而非对象：让 AOP 代理的生成推迟到真正被提前需要时
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-bl5-6
    text: Boot 2.6 起默认禁止循环依赖（allow-circular-references=false）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**循环依赖**（A 要 B、B 要 A）的解法 = **三级缓存的提前暴露**：

```
singletonObjects      一级：成品 Bean
earlySingletonObjects 二级：半成品（实例化但没装配完）
singletonFactories    三级：能产出早期引用的工厂
```

流程：A 实例化（裸对象）后**立刻**把「A 的工厂」塞进三级缓存 → 填充属性要 B → B 实例化、要 A → **从三级缓存的工厂拿 A 的早期引用**给 B → B 装配完成放一级 → A 拿到成品 B，完成。

**第三级为什么是工厂**：A 的正确注入物可能是**代理**（AOP）。若提前 new 代理，所有 Bean 都被迫提前代理；存**工厂**——**只有真被提前引用时才生成**（且记入二级缓存保证同一引用），无循环时走正常初始化后再代理。

**边界**：只救 **setter/字段注入的 singleton**；构造器循环（没实例化就没法暴露）与 prototype 直接抛异常。@Lazy 注入是把依赖换成代理、用时再解析——绕开循环。

**术语速查**：提前暴露=裸对象先挂个号｜三级缓存=成品/半成品/工厂｜工厂=代理的延迟决策

<!--advanced-->
Spring Boot 2.6 起默认禁止循环依赖（spring.main.allow-circular-references=false）——官方立场：循环是设计坏味道。getEarlyBeanReference（SmartInstantiationAwareBeanPostProcessor）是 AOP 提前代理的钩子；earlyProxyReferences 记录已代理防重复。构造器循环可用 @Lazy 参数打破。
