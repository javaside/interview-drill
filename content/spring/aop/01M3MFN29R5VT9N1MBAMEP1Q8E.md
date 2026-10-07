---
id: 01M3MFN29R5VT9N1MBAMEP1Q8E
blockId: spring/aop
relatedBlocks: []
question: 同类方法自调用为什么切面失效？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - private 方法加 @Transactional 为什么也失效？
keyPoints:
  - id: kp-aop3-1
    text: 切面=代理拦截；自调用走 this（原始对象）绕过代理
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29R5PKX9E9ZPC6XSAPB
      - 01M3MFN29RD2NVBJQYQFZNV35F
      - 01M3MFN29RMZ3AHPVWHKPZHQHZ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-aop3-2
    text: 典型受害：@Transactional 方法被同类直调，事务没开
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29RD2NVBJQYQFZNV35F
      - 01M3MFN29RMZ3AHPVWHKPZHQHZ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-aop3-3
    text: 解法 1：注入自身（@Lazy self）再通过 self 调用
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-aop3-4
    text: 解法 2：AopContext.currentProxy()（需 exposeProxy=true）；或拆类
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**根因一句话**：代理拦截的入口在「**外面的调用**」，而 `this.methodB()` 压根**没过代理**——this 是原始对象，通知链自然没人执行：

```java
@Service class S {
  @Transactional public void a() { this.b(); }   // b 的事务没生效！
  @Transactional public void b() { ... }
}
```

修法三选：①**注入自己**（`@Lazy private S self;` 然后 `self.b()`）——走代理；②`AopContext.currentProxy()`（开 exposeProxy）；③最干净——**拆类**（b 挪到另一个 Bean），设计上自调用不该跨切面边界。

同族失效：**private/final 方法**（CGLIB 覆盖不了）、**static 方法**、**catch 吞了异常**（@Transactional 默认只回滚 RuntimeException——见事务块）。

**术语速查**：自调用=this 裸奔不过代理｜注入自身=借代理绕一圈｜拆类=设计层根治

<!--advanced-->
@Transactional 的 rollbackFor 默认 RuntimeException+Error；受检异常默认不回滚。CGLIB 无法代理 final/private/static（子类覆盖语法限制）。编译期织入（AspectJ）无此限制。
