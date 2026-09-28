---
id: 01M3MFN29R8NK408F20XC6CJBC
blockId: spring/spring-mvc
relatedBlocks:
  []
question: "RESTful 的设计规范？"
cardType: enumeration
appliesTo: Spring 6+
frequency: mid
followUps:
  - PUT 和 PATCH 的区别？
keyPoints:
  - id: kp-mv5-1
    text: "资源为名词复数 + HTTP 动词表操作：GET/POST/PUT/DELETE"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-mv5-2
    text: "层级表达从属：/users/99/orders；过滤用查询参数"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-mv5-3
    text: "状态码语义化：200/201/204/400/401/403/404/409/422/500"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-mv5-4
    text: "无状态：每次请求自带全部上下文（token），服务端不存会话"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-mv5-5
    text: "版本与限流头：/v1 前缀或 Accept 头；统一错误体"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
---

**RESTful 五原则**：

- **资源名词化**：URL 只说「是什么」（`/orders`），**动作交给 HTTP 动词**——GET 读、POST 建、PUT 全量改、PATCH 部分改、DELETE 删；
- **层级从属**：`/users/99/orders`（99 的订单）；**筛选/分页走查询参数**（`?status=paid&page=2`）；
- **状态码会说话**：201 已创建、204 无内容、401 未认证 vs 403 无权限、409 冲突、422 校验失败；
- **无状态**：token 自带上下文——服务端横向扩展无会话粘滞；
- **工程配套**：版本（/v1）、统一错误体、幂等设计（PUT/DELETE 幂等，POST 不幂等——客户端重试要靠幂等键）。

**PUT vs PATCH**：PUT 是**全量替换**（整份资源提交），PATCH 是**局部更新**（只给变的字段）。

**术语速查**：名词+动词=资源与操作分离｜无状态=上下文随身带｜幂等=重放结果不变

<!--advanced-->
HATEOAS（超媒体驱动，链接即状态转移）是成熟度最高档。幂等键（Idempotency-Key 头）补 POST 的重试安全。批量操作的争议（POST /orders/batch-delete 违背纯粹性但实用主义常见）。
