---
id: 01M3MFN29RRE2JKM6YNRT3CAQG
blockId: spring/boot-autoconfig
relatedBlocks:
  []
question: "Spring Boot 启动流程？"
cardType: sequence
appliesTo: Spring 6+
frequency: high
followUps:
  - Banner 打印在启动的第几步？
keyPoints:
  - id: kp-ba3-1
    text: "第 1 步 SpringApplication.run：推断应用类型（Servlet/Reactive/无 Web）"
    public: true
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-ba3-2
    text: "第 2 步 创建并准备 ApplicationContext：注册主类、加载 Environment（yml/环境变量）"
    public: true
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-ba3-3
    text: "第 3 步 refresh：加载自动配置与用户 Bean（IoC 容器的标准启动）"
    public: true
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-ba3-4
    text: "第 4 步 启动内嵌 Web 服务器（Tomcat onRefresh）"
    public: true
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-ba3-5
    text: "第 5 步 Runner 执行：ApplicationRunner/CommandLineRunner 收尾"
    public: true
    order: 5
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
---

`SpringApplication.run()` 的五拍（按序排）：

1. **备**：推断应用类型（类路径有无 Servlet→普通 Web/响应式/纯后端）、**SpringApplication 实例**就位（banner 在这之后立刻打）；
2. **搭**：创建对应类型的 **ApplicationContext**、准备 **Environment**（application.yml→环境变量→命令行的优先级合并）；
3. **refresh**：IoC 容器标准启动——**自动配置装配** + 你的 Bean 全部落位；
4. **起 Web**：内嵌 **Tomcat** 在 refresh 的 onRefresh 阶段拉起、DispatcherServlet 注册（传统 war 是外部 Tomcat，Boot 把容器变库）；
5. **收尾**：依次执行 **ApplicationRunner/CommandLineRunner**（业务就绪钩子——启动后预热的挂点）、发布 ready 事件。

**术语速查**：应用类型推断=按 classpath 定形态｜内嵌容器=Tomcat 成依赖｜Runner=就绪后钩子

<!--advanced-->
SpringApplicationRunListener 的 starting/environmentPrepared/started/ready 事件序（EventPublishingRunListener）。lazy-initialization 全局懒加载。spring.factories 的初始化器/监听器装配。3.0 的 AOT 处理与 Native 变体（GraalVM）。
