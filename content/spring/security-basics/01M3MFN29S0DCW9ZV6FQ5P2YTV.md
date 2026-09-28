---
id: 01M3MFN29S0DCW9ZV6FQ5P2YTV
blockId: spring/security-basics
relatedBlocks:
  []
question: "JWT 在 Spring Security 里怎么落地？"
cardType: sequence
appliesTo: Spring 6+
frequency: high
followUps:
  - JWT 怎么实现登出？
keyPoints:
  - id: kp-sec3-1
    text: "第 1 步 登录接口校验账号密码 → 签发 JWT（含用户名/角色/过期时间）"
    public: true
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-sec3-2
    text: "第 2 步 客户端每次请求带 Authorization: Bearer <token>"
    public: true
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-sec3-3
    text: "第 3 步 BearerTokenAuthenticationFilter 解析验签 → 构造 Authentication 入 SecurityContext"
    public: true
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-sec3-4
    text: "第 4 步 后续链上鉴权按角色/权限放行"
    public: true
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-sec3-5
    text: "第 5 步 无状态：不存会话，登出靠客户端删 token（或黑名单）"
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

**JWT 无状态落地五步**（按序排）：

1. **登录签发**：校验成功 → 生成 JWT（payload 放用户名/角色，签名防篡改，exp 定寿）；
2. **携带**：客户端每次 `Authorization: Bearer xxx`；
3. **过滤器解析**：`BearerTokenAuthenticationFilter` 验签+查过期 → 造 Authentication 放 **SecurityContext**（ThreadLocal，本次请求有效）；
4. **鉴权**：链末按 `hasRole/hasAuthority` 放行；
5. **无状态**：服务端不存 session（`SessionCreationPolicy.STATELESS`）。

**登出的无状态困境**：token 在客户端手里没到 exp 前**仍有效**——要么客户端删（伪登出）、要么服务端**黑名单**（存 jti 到 Redis 至 exp，过滤器加查黑名单一步——牺牲一点无状态换安全）。

**术语速查**：Bearer=持有者凭证｜验签=防篡改检查｜黑名单=提前作废的 jti 名单

<!--advanced-->
刷新 token 双令牌（短 access + 长 refresh 的 /refresh 换发）。jti（JWT ID）与黑名单的 TTL 对齐 exp。签名算法族 HS/RS 与密钥轮换。会话固定攻击防护与 token 重放窗口。
