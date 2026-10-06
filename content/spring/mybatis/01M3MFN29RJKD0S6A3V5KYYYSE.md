---
id: 01M3MFN29RJKD0S6A3V5KYYYSE
blockId: spring/mybatis
relatedBlocks: []
question: 动态 SQL 有哪些标签？
cardType: enumeration
appliesTo: Spring 6+
frequency: mid
followUps:
  - where 标签智能在哪？
keyPoints:
  - id: kp-my4-1
    text: if：条件片段（test 的 OGNL 表达式）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-my4-2
    text: where/trim：智能拼出无残留的 where 与前后缀
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-my4-3
    text: foreach：集合展开成 in 列表（collection/item/separator）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-my4-4
    text: choose/when/otherwise：多路分支；set 与 trim 同理智能拼 set
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-my4-5
    text: bind 标签可声明中间变量用于 like 拼接
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**动态 SQL**=SQL 的模板引擎，四组标签：

- **`<if test="name != null">`**：条件成立才拼这一段（OGNL 判断）；
- **`<where>`**：智能 where——**自动去掉开头多余的 AND/OR**（if 全不成立则整个 where 消失）；`<set>` 同理（智能逗号）；更通用的 `<trim>` 自定义前后缀与裁剪；
- **`<foreach>`**：集合展开——`in (?,?,?)` 的批量/in 查询标配（collection 源、item 名、separator 分隔）；
- **`<choose>/<when>/<otherwise>`**：switch 分支（多条件取一）。

**术语速查**：智能裁剪=去掉残留 AND/逗号｜foreach=集合变 in 列表｜OGNL=表达式判断语言

<!--advanced-->
OGNL 的属性导航与方法调用；`<bind>` 声明中间变量（like 模糊拼接的 likeBind）。大 in 的分批（foreach 超千项的 SQL 长度/性能）。DatabaseIdProvider 的多方言分支。
