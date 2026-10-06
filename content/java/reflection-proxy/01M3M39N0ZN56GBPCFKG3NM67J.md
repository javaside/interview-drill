---
id: 01M3M39N0ZN56GBPCFKG3NM67J
blockId: java/reflection-proxy
relatedBlocks: []
question: JDK 动态代理和 CGLIB 的区别？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - MethodInterceptor 和 InvocationHandler 的对应关系？
keyPoints:
  - id: kp-rf4-1
    text: JDK 代理：基于接口，代理类实现接口并转发 InvocationHandler
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-rf4-2
    text: CGLIB：基于继承，运行时生成目标类的子类覆盖非 final 方法
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-rf4-3
    text: CGLIB 不能代理 final 类/final 方法/private/static 方法
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-rf4-4
    text: Spring Boot 2+ 默认 CGLIB（proxyTargetClass=true），避免接口/实现类型不一致问题
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

两条流派：

- **JDK 动态代理**：**面向接口**。生成的类 `implements 你的接口`，调用转给 **InvocationHandler**。目标没接口就抓瞎。
- **CGLIB**：**面向继承**。运行时生成目标类的**子类**，覆盖方法插入拦截（**MethodInterceptor**）。要求类可继承、方法非 final——final 类/方法、private、static 都代理不了。

Spring 的选择逻辑：有接口默认 JDK、没有则 CGLIB；**Spring Boot 2+ 干脆全 CGLIB**（`proxyTargetClass=true`）——避免「注入类型必须是接口」带来的割裂。

**术语速查**：接口流派=实现接口转发｜继承流派=生成子类覆盖｜final 免死=final 不可被子类改写

<!--advanced-->
CGLIB 底层 ASM 字节码库；FastClass 机制以索引直呼方法避免反射开销。CGLIB 无法代理构造器（Objenesis 绕开实例化）。JDK17+ 对字节码生成的模块限制令内嵌版升级潮（Spring 6 自 fork cglib）。代理对象 equals/hashCode 的语义一致性需拦截器自行维护。
