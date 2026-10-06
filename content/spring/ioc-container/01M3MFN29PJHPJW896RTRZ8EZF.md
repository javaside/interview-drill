---
id: 01M3MFN29PJHPJW896RTRZ8EZF
blockId: spring/ioc-container
relatedBlocks: []
question: 什么是 IoC？它解决了什么问题？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - IoC 和 DI 是一回事吗？
keyPoints:
  - id: kp-ioc1-1
    text: 控制反转：对象的创建与装配从代码移交给容器
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ioc1-2
    text: 解耦：对象声明需要什么，不自己 new 依赖
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ioc1-3
    text: DI（依赖注入）是 IoC 的主要实现方式
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ioc1-4
    text: 收益：可测（mock 注入）、可替换（面向接口）、生命周期统一管理
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**IoC（控制反转）**= 把「**谁来创建对象、谁来接线**」这件事从你的代码手里**夺走**，交给容器：

- 传统：`new UserService(new MysqlUserDao(new Datasource(...)))`——每层自己 new，改一个实现层层改动，测试只能连真库；
- IoC：你只**声明**（`@Autowired` / 构造参数），**容器读配置反射造齐整**递给你。

**DI（依赖注入）**是 IoC 的落地手段：**构造器注入/Setter 注入/字段注入**。收益三连：**面向接口可替换**（换实现零改动）、**可测**（测试注入 mock）、**生命周期统一**（单例/销毁容器管）。

**术语速查**：控制反转=创建装配权上交｜DI=IoC 的实现方式｜声明式=我只说要什么

<!--advanced-->
IoC Service Provider 模式（依赖拖拽/依赖注入两种形态）；Spring 的 BeanFactory（基础容器）与 ApplicationContext（事件/国际化/AOP 集成）。构造器注入被官方推荐（不可变、强制依赖、利于测试发现依赖环）。
