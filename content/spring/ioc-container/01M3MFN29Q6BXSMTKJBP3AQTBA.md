---
id: 01M3MFN29Q6BXSMTKJBP3AQTBA
blockId: spring/ioc-container
relatedBlocks: []
question: BeanFactory 和 ApplicationContext 的区别？
cardType: enumeration
appliesTo: Spring 6+
frequency: mid
followUps:
  - 懒加载和预实例化各有什么代价？
keyPoints:
  - id: kp-ioc3-1
    text: BeanFactory 是最小容器：懒加载，getBean 时才造
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ioc3-2
    text: ApplicationContext 是超集：启动时预实例化单例
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ioc3-3
    text: ApplicationContext 额外提供：事件发布、国际化、AOP 集成、环境抽象
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ioc3-4
    text: 实际开发全用 ApplicationContext（AnnotationConfig/Web 组合）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**BeanFactory** 是「最低配置版」容器：只管**造和给**（getBean 时才真正实例化——懒加载）；**ApplicationContext** 是「全家桶」：启动时把**所有单例预造好**，再叠加事件机制、国际化、环境 Profile、AOP 自动代理。

代价对比：懒启动**快**但**首次请求慢一拍**（还在用的时候才暴露配置错）；预实例化**启动慢**但问题**启动即暴露**、运行期稳定——生产服务要的是后者。

**术语速查**：懒加载=要时再造｜预实例化=启动全造｜启动即暴露=配置错别活到线上

<!--advanced-->
ApplicationContext 继承 ListableBeanFactory/HierarchicalBeanFactory/MessageSource/ApplicationEventPublisher。AbstractApplicationContext.refresh() 的十二步模板方法。AnnotationConfigApplicationContext 的 ConfigurationClassPostProcessor 驱动 @Configuration 解析。
