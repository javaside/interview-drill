---
id: 01M3MFN29QYPHCN40Z6TB1ZRZD
blockId: spring/ioc-container
relatedBlocks: []
question: 容器启动（refresh）大致做什么？
cardType: sequence
appliesTo: Spring 6+
frequency: high
followUps:
  - 为什么 BFPP 在 Bean 实例化之前跑？
keyPoints:
  - id: kp-ioc4-1
    text: prepareRefresh：容器状态与环境准备
    public: true
    order: 1
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ioc4-2
    text: obtainBeanFactory：加载 BeanDefinition（扫描注解/解析配置类）
    public: true
    order: 2
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ioc4-3
    text: invokeBeanFactoryPostProcessors：BFPP 改造Bean定义（配置类解析在此）
    public: true
    order: 3
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ioc4-4
    text: registerBeanPostProcessors：注册 Bean 后置处理器
    public: true
    order: 4
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ioc4-5
    text: finishBeanFactoryInitialization：预实例化所有非懒加载单例
    public: true
    order: 5
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29Q6BXSMTKJBP3AQTBA
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

`refresh()` 是容器启动的**主旋律**（模板方法十二步，核心五拍按序排）：

1. **准备**：容器状态、环境校验；
2. **拿 BeanFactory**：加载 **BeanDefinition**（类的「配方」——从哪来、单例否、依赖谁）；
3. **BFPP（BeanFactoryPostProcessor）**：**改配方**的钩子——`@Configuration` 解析、`@Bean` 注册、占位符替换全在这一步。**配方定型后才造菜**——所以它在 Bean 实例化**之前**；
4. **注册 BeanPostProcessor**：**改菜**的钩子（@Autowired 填充、AOP 代理都在其中）登记就位；
5. **预实例化**：所有非懒单例此刻真造（走完整生命周期）——完成即容器就绪。

**术语速查**：BeanDefinition=配方卡｜BFPP=改配方（启动期一次）｜BeanPostProcessor=改菜（每个 Bean 两次）

<!--advanced-->
十二步含 initMessageSource/initApplicationEventMulticaster/onRefresh(Web 容器启 Tomcat)/registerListeners。ConfigurationClassPostProcessor 即 BFPP 的 PriorityOrdered 实现；AutowiredAnnotationBeanPostProcessor 与 AbstractAutoProxyCreator 是 BPP 双雄。
