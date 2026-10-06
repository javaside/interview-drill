---
id: 01M3MFN29RDDK0FWRVKXGYJDE5
blockId: spring/mybatis
relatedBlocks: []
question: '#{} 和 ${} 的区别？'
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 为什么
keyPoints:
  - id: kp-my1-1
    text: '#{} 预编译占位：值以参数形式进 PreparedStatement，防注入'
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-my1-2
    text: ${} 字符串替换：直接拼进 SQL——注入风险
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-my1-3
    text: ${} 仅用于表名/列名/排序字段这类不能参数化的位置
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-my1-4
    text: 动态排序（order by ${col}）必须白名单校验输入
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

差在**进 SQL 的方式**：

- **`#{}`**：**预编译占位符**——SQL 先变成 `where name = ?` 发给数据库，值作为**参数**单独传输。引号、分号都只是「参数里的字符」，动摇不了 SQL 结构——**天然防注入**；
- **`${}`**：**字符串原样拼接**——`' or '1'='1` 拼进去就是 SQL 的一部分——**注入大门**。

`${}` 的合法用武之地：**没法参数化**的结构部位——表名、列名、`order by` 的字段。这些位置必须**白名单校验**（列名集合里查得到才放行），绝不能裸接用户输入。

**术语速查**：预编译=结构与值分离｜拼接=值变结构的一部分｜白名单=枚举合法值

<!--advanced-->
PreparedStatement 的执行计划复用（同构 SQL 缓存）；注入的本质是数据逃逸成代码。MyBatis 的 `statementType`/`languageDriver` 扩展点。动态表名的 sharding 场景常配合 ${} + 源码级校验。
