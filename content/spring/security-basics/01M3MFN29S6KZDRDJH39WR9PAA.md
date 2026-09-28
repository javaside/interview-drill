---
id: 01M3MFN29S6KZDRDJH39WR9PAA
blockId: spring/security-basics
relatedBlocks:
  []
question: "Spring Security 的过滤链原理？"
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - JWT 场景怎么接进这条链？
keyPoints:
  - id: kp-sec1-1
    text: "一组 Filter 构成的链（FilterChainProxy），在 DispatcherServlet 之前守门"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-sec1-2
    text: "UsernamePasswordAuthenticationFilter 拦表单登录，BearerTokenAuthenticationFilter 拦 JWT"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-sec1-3
    text: "SecurityContext 存认证结果（默认 ThreadLocal+HttpSession）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-sec1-4
    text: "认证管理器 AuthenticationManager 委托 Provider 校验"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-sec1-5
    text: "无认证且受保护资源 → ExceptionTranslationFilter 引导到入口点（401/登录页）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
---

**Spring Security = 一条 Servlet Filter 链**（DelegatingFilterProxy 注册的 FilterChainProxy）：所有请求先过它再到 MVC。链上各 Filter 分工：

- **认证类**：`UsernamePasswordAuthenticationFilter`（表单）、`BearerTokenAuthenticationFilter`（**JWT**——解析 Authorization 头、验签建 Authentication 放进 SecurityContext）；
- **校验中枢**：**AuthenticationManager** → 委托各 **AuthenticationProvider**（DaoProvider 查库比对密码）；
- **异常翻译**：`ExceptionTranslationFilter` 把认证/权限异常翻译成 401/403 或登录跳转；
- **末端的 FilterSecurityInterceptor/AuthorizationFilter**：按规则（`authorizeHttpRequests`）做**鉴权**终审。

**术语速查**：FilterChainProxy=链总管｜Authentication=认证成功的凭证对象｜鉴权=有没有权限（区别认证=你是谁）

<!--advanced-->
SecurityFilterChain 的多链按 matcher 匹配（order 敏感）。SecurityContextHolder 的 MODE_THREADLOCAL/INHERITABLE（@Async 的上下文丢失与 DelegatingSecurityContextExecutor）。6+ 的 Lambda DSL 与 authorizeHttpRequests 替代 antMatchers 体系。
