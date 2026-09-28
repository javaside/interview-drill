---
id: 01M3MFN29QPGXTF1GB2N69HXVE
blockId: spring/bean-lifecycle
relatedBlocks:
  - spring/ioc-container
question: "一个 Bean 的完整生命周期？"
cardType: sequence
appliesTo: Spring 6+
frequency: high
followUps:
  - 为什么 AOP 代理在初始化之后？
keyPoints:
  - id: kp-bl1-1
    text: "第 1 步 实例化：构造器造出裸对象"
    public: true
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-bl1-2
    text: "第 2 步 属性填充：@Autowired/@Value 依赖注入"
    public: true
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-bl1-3
    text: "第 3 步 Aware 回调：BeanName/BeanFactory/ApplicationContext"
    public: true
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-bl1-4
    text: "第 4 步 初始化前：BeanPostProcessor.postProcessBeforeInitialization（@PostConstruct 在此）"
    public: true
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-bl1-5
    text: "第 5 步 初始化：InitializingBean.afterPropertiesSet 与 init-method"
    public: true
    order: 5
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-bl1-6
    text: "第 6 步 初始化后：BPP 的 after 钩子（AOP 代理在此织入）；容器关闭时销毁回调"
    public: true
    order: 6
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
---

单例 Bean 从出生到销毁的**七拍**（按序排）：

```
①构造器 → ②属性填充 → ③Aware 回调 → ④初始化前（@PostConstruct）
→ ⑤初始化（afterPropertiesSet/init-method）
→ ⑥初始化后（AOP 代理在此生成替换原对象）
→ ⑦使用…容器关闭 → @PreDestroy 销毁
```

**为什么 AOP 在⑥**：代理要**包装一个完整成品**（属性已填、初始化已跑）——所以 postProcessAfterInitialization 里生成代理对象，容器里放的是**代理**而非原始对象。这也解释了同类自调用为什么不走代理：**this 是原始对象，不是代理**。

**术语速查**：裸对象=刚构造没装配｜填充=依赖注入｜后置处理器=每 Bean 两钩子（前/后初始化）

<!--advanced-->
@PostConstruct 由 CommonAnnotationBeanPostProcessor（④）处理；afterPropertiesSet 与 init-method 同序执行（接口优先）。InitializingBean 暴露接口污染，推荐 @PostConstruct/init-method。AbstractAutoProxyCreator 实现 BPP 的 after 阶段（还有它在③前的 earlyProxyReferences 分支支撑循环依赖）。
