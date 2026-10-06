---
id: 01M3MFN29QCTRBXKVJJ89SZ8TG
blockId: spring/ioc-container
relatedBlocks: []
question: BeanDefinition 是什么？
cardType: atomic
appliesTo: Spring 6+
frequency: mid
followUps:
  - Spring 里有几处产生 BeanDefinition 的方式？
keyPoints:
  - id: kp-ioc5-1
    text: Bean 的配方卡：类名、作用域、依赖、初始化方法、懒加载——容器照它实例化装配
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**BeanDefinition = Bean 的配方卡**：容器并不直接拿着类干活，而是先把每个 Bean 的**元信息**登记成一张卡——类名（照它反射造）、作用域（单例/原型）、依赖（照它注入）、init/destroy 方法、懒加载……

产生配方卡的途径：`@Component` 扫描、`@Bean` 方法、XML 定义、`BeanDefinitionRegistry` 手工注册。**改配方**（BFPP）与**照配方做菜**（实例化+装配）由此解耦——这也解释了为什么 @Configuration 解析发生在任何 Bean 创建之前。

**术语速查**：配方卡=类怎么造的元数据｜注册表=配方卡的柜子

<!--advanced-->
AnnotatedGenericBeanDefinition/ScannedGenericBeanDefinition 等家族；BeanDefinitionBuilder/BeanDefinitionRegistryPostProcessor 动态注册（MyBatis Mapper 扫描的注册器即此）。merge 后的 RootBeanDefinition 才进入实例化流程。
