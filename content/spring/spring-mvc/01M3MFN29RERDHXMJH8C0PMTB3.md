---
id: 01M3MFN29RERDHXMJH8C0PMTB3
blockId: spring/spring-mvc
relatedBlocks: []
question: 一次请求在 Spring MVC 里的完整流程？
cardType: sequence
appliesTo: Spring 6+
frequency: high
followUps:
  - 拦截器在哪一步介入？
keyPoints:
  - id: kp-mv1-1
    text: DispatcherServlet 收请求（前端控制器总入口）
    public: true
    order: 1
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-mv1-2
    text: HandlerMapping 找处理器：URL→HandlerExecutionChain（含拦截器）
    public: true
    order: 2
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29R4TDV0YXT34VACC3M
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-mv1-3
    text: HandlerAdapter 执行 Controller 方法（参数解析/数据绑定）
    public: true
    order: 3
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-mv1-4
    text: Controller 返回 ModelAndView（@ResponseBody 走 HttpMessageConverter 直接写响应）
    public: true
    order: 4
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-mv1-5
    text: ViewResolver 解析视图 → View 渲染 → 响应
    public: true
    order: 5
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

Spring MVC 一切请求过** DispatcherServlet**（前端控制器）这条总闸，五步（按序排）：

1. **收**：DispatcherServlet 接请求；
2. **找**：**HandlerMapping** 把 URL 映射成 HandlerExecutionChain（Controller 方法 + 拦截器链）；
3. **执**：**HandlerAdapter** 负责调——**参数解析**（@RequestParam/@RequestBody 的转换绑定）→ 反射调用方法；
4. **果**：返回 **ModelAndView**（页面时代）——前后端分离下 `@ResponseBody` 直接由 **HttpMessageConverter**（如 Jackson）序列化写回，跳过视图；
5. **渲**：ViewResolver 定视图、View 渲染输出。

**拦截器（HandlerInterceptor）**挂在第 2 步拿到的链上：preHandle（方法前）/postHandle（方法后视图前）/afterCompletion（响应后）。

**术语速查**：前端控制器=总闸｜HandlerMapping=URL→方法｜拦截器三拍=pre/post/after

<!--advanced-->
RequestMappingHandlerMapping 解析 @RequestMapping 建 Registry；参数解析器（HandlerMethodArgumentResolver）与返回值处理器（HandlerMethodReturnValueHandler）的策略族。@RestController = @Controller + @ResponseBody（MappingJackson2HttpMessageConverter 默认注册）。@ControllerAdvice 的 @ExceptionHandler 全局异常在 DispatcherServlet.processHandlerException 捕获。
