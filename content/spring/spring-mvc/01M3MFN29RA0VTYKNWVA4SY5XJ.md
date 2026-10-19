---
id: 01M3MFN29RA0VTYKNWVA4SY5XJ
blockId: spring/spring-mvc
relatedBlocks: []
question: RESTful 接口怎么统一异常处理？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 404 应该怎么处理？
keyPoints:
  - id: kp-mv3-1
    text: '@RestControllerAdvice + @ExceptionHandler：全局按异常类型分发出错响应'
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-mv3-2
    text: 自定义业务异常携带错误码，统一响应体（code/message/data）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-mv3-3
    text: 参数校验异常（MethodArgumentNotValidException）单独接住转 400
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-mv3-4
    text: 未知异常兜底 500 且不泄露堆栈，日志记全
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core

misconceptions:
  - id: mc-mv3-1
    text: '@RestControllerAdvice 是全局兜底，连 Filter 阶段抛出的异常也能捕获'
    why: 误解：Advice 只覆盖进入 Handler 之后的处理过程；Filter 运行在 DispatcherServlet 之前，那里抛的异常根本走不到它
  - id: mc-mv3-2
    text: Controller 里写的 @ExceptionHandler 会被全局 Advice 抢先捕获，局部处理器白写
    why: 误解：查找顺序是本类优先，本类没有匹配的处理器才去问 ControllerAdvice，局部永远排在全局前面
  - id: mc-mv3-3
    text: 系统抛未知异常时把堆栈放进响应 message 返回，前端好定位问题
    why: 误解：堆栈会把内部实现暴露给攻击者，对外只给笼统提示，完整堆栈进日志
---

**统一异常三件套**：

1. **@RestControllerAdvice + @ExceptionHandler**：全局异常处理器——按异常类型**精确捕获**（`@ExceptionHandler(BizException.class)`）转成统一响应体；
2. **业务异常体系**：自定义 `BizException(code, msg)` 带错误码——业务错误语义化，不用字符串碰运气；
3. **分类兜底**：参数校验失败（`MethodArgumentNotValidException`）→ **400** + 字段级错误信息；业务异常 → 对应码；**Exception 兜底 → 500**——对外只给「系统繁忙」，**堆栈只进日志**（别把内部细节漏给调用方）。

404 这类**没进到 Handler** 的错误：`spring.mvc.throw-exception-if-no-handler-found=true`（+ 关静态资源映射）让它变成 NoHandlerFoundException 进统一通道；或网关/前端路由层处理。

**术语速查**：Advice=全局顾问｜错误码=机器读的失败语义｜兜底=未知异常的最后防线

<!--advanced-->
@ResponseStatus 与 ResponseEntity 的两种出口。异常处理优先级：本类 @ExceptionHandler > 本 ControllerAdvice > 全局 Advice；@Order 控制多个 Advice。校验链 @Validated 分组与快速失败模式。ProblemDetail（RFC 7807，Boot 3）标准化错误体。
