---
id: 01M3MFN29R5P7NZEFGXBV390XM
blockId: spring/boot-autoconfig
relatedBlocks: []
question: 自动配置的原理（条件装配）？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 怎么写一个自定义 starter？
keyPoints:
  - id: kp-ba2-1
    text: 起步依赖引入 jar → AutoConfiguration.imports 声明候选配置类
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ba2-2
    text: '@ConditionalOnClass/MissingBean/Property 按条件生效'
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ba2-3
    text: '@ConditionalOnMissingBean：你配了就以你的为准（默认可覆盖）'
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ba2-4
    text: 配置属性绑定：@EnableConfigurationProperties + @ConfigurationProperties
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ba2-5
    text: 排除不想要的自动配置：exclude 或 excludeName
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**自动装配的推理链**：

```
classpath 有 mysql-connector → 候选配置类 DataSourceAutoConfiguration 命中
  → @ConditionalOnClass(DataSource.class) ✓
  → @ConditionalOnMissingBean(DataSource) ✓（你没自己配）
  → @EnableConfigurationProperties(DataSourceProperties) ← application.yml 的 spring.datasource.* 绑进来
  → 容器里出现 DataSource
```

**核心机关是条件注解族**：`@ConditionalOnClass`（类路径有没有）、`@ConditionalOnMissingBean`（**你没配才给默认**——覆盖式设计）、`@ConditionalOnProperty`（配置开关）。

**自定义 starter 三步**：①`XxxAutoConfiguration` + 条件注解写好；②`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`（2.7+ 格式）登记；③配置属性类 `@ConfigurationProperties(prefix="xxx")` 暴露 yml 调节点。

**术语速查**：classpath 驱动=有 jar 才有配置｜MissingBean=你不配我才配｜imports 文件=候选配置登记簿

<!--advanced-->
2.7 前的 spring.factories 格式已废弃。条件评估顺序（OnClass 在 OnMissingBean 前——类都没了谈不上 Bean）。@AutoConfigureBefore/After 控制配置类间序。@ConfigurationProperties 的构造器绑定与 @Validated 校验。
