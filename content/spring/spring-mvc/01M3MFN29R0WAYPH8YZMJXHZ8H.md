---
id: 01M3MFN29R0WAYPH8YZMJXHZ8H
blockId: spring/spring-mvc
relatedBlocks:
  []
question: "@RequestBody 和 @RequestParam 的区别？"
cardType: enumeration
appliesTo: Spring 6+
frequency: mid
followUps:
  - form 表单提交用哪个接？
keyPoints:
  - id: kp-mv4-1
    text: "@RequestParam：URL 查询参数/表单字段（?name=x）"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-mv4-2
    text: "@RequestBody：请求体反序列化成对象（JSON→POJO，HttpMessageConverter）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-mv4-3
    text: "@PathVariable：路径占位符（/users/{id}）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-mv4-4
    text: "一个方法只能有一个 @RequestBody（体只读一次）；param 可多个"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
---

按**数据在哪**选注解：

| 数据位置 | 注解 | 例子 |
|---|---|---|
| URL 问号后 | **@RequestParam** | `?page=1` |
| 路径占位符 | **@PathVariable** | `/users/99` |
| 请求体（JSON） | **@RequestBody** | `{"name":"x"}` |
| 表单（form-urlencoded） | 无注解/ModelAttribute 按名绑定 | `name=x&age=1` |

**form 表单**按字段名直接绑定到对象（不写注解即可）——Spring 的数据绑定按 setter 对名。**@RequestBody 一次请求只能有一个**（流只读一次）；JSON 数组/嵌套对象必须靠它走转换器。

**术语速查**：查询参数=问号后面｜体反序列化=JSON 变对象｜表单绑定=按名 set

<!--advanced-->
HttpMessageConverter 的 Content-Type 协商（MappingJackson2 对 application/json）。@RequestHeader/@CookieValue 补位。MultipartFile 的 mutipart 解析在 Filter 后参数解析前（StandardServletMultipartResolver）。
