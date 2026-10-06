---
id: 01M3MFN29SSW7Y9HZ44YHBZTK3
blockId: spring/security-basics
relatedBlocks: []
question: CSRF 是什么？Spring Security 怎么防？
cardType: enumeration
appliesTo: Spring 6+
frequency: mid
followUps:
  - 为什么 JWT 不怕 CSRF？
keyPoints:
  - id: kp-sec5-1
    text: 攻击：恶意网站借你浏览器里未过期的 Cookie 冒充你发请求
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-sec5-2
    text: 前提：浏览器自动带 Cookie + 目标站点有会话
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-sec5-3
    text: 防御：CsrfFilter 要求请求携带服务端下发的一次性 token（表单隐藏域/header）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-sec5-4
    text: JWT 无状态（token 主动放 header 不自动随行）天然免疫 CSRF
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-sec5-5
    text: SameSite Cookie 属性是浏览器层的另一道闸
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**CSRF**（跨站请求伪造）= 坏网站让你**已登录**的浏览器「顺手」向银行网站发转账——浏览器**自动带 Cookie**，银行一看凭证齐全就执行了。它没偷密码，是**借你的浏览器用你的会话**。

**防御**：服务端（登录时）下发**一次性 CSRF token**，每个写请求必须带上（表单隐藏域/X-CSRF-TOKEN 头）——坏网站**拿不到**这个 token（同源策略挡着），请求即被 `CsrfFilter` 拒绝。

**JWT 天然免疫**：token 放在 **Authorization 头**由 JS **主动**携带——浏览器不会「自动」附上；跨站页面的请求发不出这个头。（Cookie+会话方案才需要 CSRF token；同理 SameSite=Lax 的 Cookie 属性从浏览器侧限行跨站携带。）

**术语速查**：冒充=借浏览器用会话｜一次性 token=坏站拿不到的通行证｜主动携带 vs 自动随行

<!--advanced-->
Synchronizer Token 与 Double Submit Cookie 两变体；GET 幂等豁免。SameSite 的 Strict/Lax/None 梯度。CORS 与 CSRF 的混淆辨析（CORS 是浏览器对读响应的放行策略，不拦截请求发出——不是 CSRF 防线）。
