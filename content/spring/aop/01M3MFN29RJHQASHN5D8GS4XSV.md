---
id: 01M3MFN29RJHQASHN5D8GS4XSV
blockId: spring/aop
relatedBlocks:
  []
question: "JDK 代理和 CGLIB 怎么选？"
cardType: enumeration
appliesTo: Spring 6+
frequency: mid
followUps:
  - 目标类有接口就一定走 JDK 吗？
keyPoints:
  - id: kp-aop5-1
    text: "JDK：面向接口，Proxy.newProxyInstance + InvocationHandler"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-aop5-2
    text: "CGLIB：面向继承，运行时生成子类覆盖方法（MethodInterceptor）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-aop5-3
    text: "CGLIB 限制：final 类/方法、private、static 不可代理"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-aop5-4
    text: "Boot 2+ 默认全 CGLIB——避免「注入类型必须接口」的割裂"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
---

**两条代理路线**：

- **JDK 动态代理**：要求目标**实现接口**——生成 `接口的实现类` 把调用转 InvocationHandler。局限：只能代理接口方法；
- **CGLIB**：生成目标的**子类**覆盖非 final 方法——不需要接口，但 **final 类/方法、private、static 天生免疫**（子类覆盖不了）。

**Spring Boot 2+ 默认 proxyTargetClass=true（全 CGLIB）**：注入时可以直接给实现类型（不必转接口），规避 JDK 代理下「类型割裂」引发的一堆 ClassCastException。性能差距在现代 CGLIB（内嵌重写版）已可忽略，选型以**功能与一致**为先。

**术语速查**：接口流派=实现接口｜继承流派=子类覆盖｜Boot 默认=全 CGLIB

<!--advanced-->
CGLIB 底层 ASM；FastClass 索引直呼方法免反射。构造器不拦（Objenesis 绕过实例化）。代理对象的 equals/hashCode/toString 需拦截器显式处理。JDK17+ 模块强封装推动 Spring 6 自维护 cglib 变体。
