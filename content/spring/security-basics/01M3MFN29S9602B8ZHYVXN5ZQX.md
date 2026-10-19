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

misconceptions:
  - id: mc-sec2-1
    text: 没登录返回 403，权限不足返回 401，因为 401 的英文原义就是 Unauthorized（未授权）
    why: 误解：401 的真实语义是未认证（请先带凭证重来），权限不足是 403 Forbidden，名字里的 Unauthorized 是历史误导
  - id: mc-sec2-2
    text: JWT 验签属于鉴权环节，因为校验 token 就是在检查能不能访问这个接口
    why: 误解：验签认的是身份（认证，产出你是谁），能不能访问是随后按角色/权限做的鉴权判断
  - id: mc-sec2-3
    text: 鉴权失败也走认证入口点，把用户重定向到登录页重新登录就能解决
    why: 误解：入口点只处理未认证（401/登录跳转），已认证但无权限走拒绝处理器直接回 403，重登也换不出新的权限
---

两道关：

- **认证（Authentication）= 验明正身**：账号密码对不对、JWT 签名真不真——产出「你是谁」（Authentication 对象）；
- **鉴权（Authorization）= 查你权限**：身份已知，这个接口你的角色碰得吗？

HTTP 语义对应：**401 Unauthorized**（名字有误导，实指未认证——请先登录/带凭证）；**403 Forbidden**（认证过了，但没权限——别再试了）。Spring 里认证失败走入口点（登录跳转/401），鉴权失败走拒绝处理器（403）。

**术语速查**：认证=你是谁｜鉴权=你能不能｜401 未认证 403 无权限

<!--advanced-->
GrantedAuthority/角色层级（RoleHierarchy）；方法级 @PreAuthorize/@PostAuthorize 的 AOP 拦截。前后的安全上下文传播（方法级的 SecurityMetadataSource）。
