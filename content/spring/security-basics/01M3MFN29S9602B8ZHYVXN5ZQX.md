---
id: 01M3MFN29S9602B8ZHYVXN5ZQX
blockId: spring/security-basics
relatedBlocks: []
question: 认证和鉴权的区别？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 为什么 401 和 403 要分开？
keyPoints:
  - id: kp-sec2-1
    text: 认证 Authentication：你是谁（登录/JWT 验签）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWG8CF6C9PGA4451HNQ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-sec2-2
    text: 鉴权 Authorization：你能干什么（角色/权限校验）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWG8CF6C9PGA4451HNQ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-sec2-3
    text: Spring 中分离：AuthenticationManager 管认证、AccessDecisionManager/AuthorizationManager 管鉴权
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-sec2-4
    text: 401=未认证；403=已认证但无权限
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29R8NK408F20XC6CJBC
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

两道关：

- **认证（Authentication）= 验明正身**：账号密码对不对、JWT 签名真不真——产出「你是谁」（Authentication 对象）；
- **鉴权（Authorization）= 查你权限**：身份已知，这个接口你的角色碰得吗？

HTTP 语义对应：**401 Unauthorized**（名字有误导，实指未认证——请先登录/带凭证）；**403 Forbidden**（认证过了，但没权限——别再试了）。Spring 里认证失败走入口点（登录跳转/401），鉴权失败走拒绝处理器（403）。

**术语速查**：认证=你是谁｜鉴权=你能不能｜401 未认证 403 无权限

<!--advanced-->
GrantedAuthority/角色层级（RoleHierarchy）；方法级 @PreAuthorize/@PostAuthorize 的 AOP 拦截。前后的安全上下文传播（方法级的 SecurityMetadataSource）。
