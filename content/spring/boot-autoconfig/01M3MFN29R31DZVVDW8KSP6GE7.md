---
id: 01M3MFN29R31DZVVDW8KSP6GE7
blockId: spring/boot-autoconfig
relatedBlocks: []
question: starter 是什么？为什么需要？
cardType: enumeration
appliesTo: Spring 6+
frequency: mid
followUps:
  - 为什么不该把版本号写死在每个依赖里？
keyPoints:
  - id: kp-ba4-1
    text: 依赖聚合 + 自动配置的打包：引一个 starter 得到全家桶
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ba4-2
    text: spring-boot-starter-web=SpringMVC+Jackson+Tomcat 版本对齐
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ba4-3
    text: 解决依赖地狱：版本由 Boot BOM 统一仲裁
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ba4-4
    text: 约定优于配置：默认即可跑，要改走 yml
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**Starter = 依赖打包（BOM 版本对齐）+ 自动配置（缺省可跑）**：

- `spring-boot-starter-web` 一个声明拉齐 **SpringMVC + Jackson + 内嵌 Tomcat** 的**兼容版本组合**——版本由 Boot 的 BOM 统一仲裁，终结「A 要 x.1、B 要 x.3」的依赖地狱；
- 引入即**默认可用**（约定），不合意改 **yml**（覆盖）——配合 @ConditionalOnMissingBean 的覆盖设计。

自研团队也这么干：`company-starter-redis` 把连接池参数、序列化、监控埋点配好——业务引一个依赖即得标准件。

**术语速查**：BOM=版本仲裁单｜聚合=一个坐标拉全家桶｜约定优先=默认能跑

<!--advanced-->
starter 结构惯例：xxx-spring-boot-autoconfigure（配置）+ xxx-spring-boot-starter（空聚合）分包。BOM 的 dependencyManagement 导入（parent 或 import scope）。Boot 3 的 native/CRaC 场景对 starter 的约束（免反射代理处）。
