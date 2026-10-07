---
id: 01M3MFN29R4TDV0YXT34VACC3M
blockId: spring/spring-mvc
relatedBlocks: []
question: 拦截器和 Filter 的区别？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 登录校验放 Filter 还是拦截器？
keyPoints:
  - id: kp-mv2-1
    text: Filter 是 Servlet 规范（容器级），拦截器是 Spring MVC 专属
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-mv2-2
    text: 拦截器能拿到 HandlerMethod（知道要执行哪个方法），Filter 不能
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-mv2-3
    text: 执行序：Filter→DispatcherServlet→拦截器→Controller
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-mv2-4
    text: 拦截器可注入 Spring Bean 天然；Filter 若需注入要 DelegatingFilterProxy
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29S6KZDRDJH39WR9PAA
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-mv2-5
    text: preHandle 返回 false 可短路；afterCompletion 无论成败都执行（清理资源）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**层次不同**：Filter 在 **Servlet 容器层**（包裹整个 DispatcherServlet），拦截器在 **Spring MVC 层**（只管进到 MVC 的请求）：

```
请求 → Filter（doFilter）→ DispatcherServlet → 拦截器.preHandle → Controller
                                        ← postHandle ← Controller
                    ← afterCompletion（响应后）←
```

**选型**：要**感知 Spring**（拿 HandlerMethod、注入 Service、只在 MVC 生效）→ **拦截器**（登录态、权限、日志埋点）；要**更底层**（字符编码、CORS 全局、包装流、非 MVC 资源也要管）→ **Filter**。登录校验要查用户服务/看路由方法级注解 → **拦截器**更顺。

**术语速查**：容器级=Filter 的地盘｜HandlerMethod=将要执行的方法元数据｜三拍=pre/post/afterCompletion

<!--advanced-->
DelegatingFilterProxy 把 Filter 委托给容器 Bean（springSecurityFilterChain 即此）。拦截器的 afterCompletion 在异常时也执行（finally 语义）；postHandle 在 @ResponseBody 场景发生在写响应之后（不宜改响应体）。Spring Security 本质是 Filter 链（含 MVC 前的守门）。
