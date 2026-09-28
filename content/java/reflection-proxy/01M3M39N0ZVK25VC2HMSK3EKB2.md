---
id: 01M3M39N0ZVK25VC2HMSK3EKB2
blockId: java/reflection-proxy
relatedBlocks:
  []
question: "JDK 动态代理的原理？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 代理类是怎么生成的？
keyPoints:
  - id: kp-rf3-1
    text: "运行时生成实现接口的代理类（$Proxy0），方法调用统一转发 InvocationHandler"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-rf3-2
    text: "InvocationHandler.invoke(proxy, method, args)：切面逻辑的落点"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-rf3-3
    text: "只能代理接口（代理类继承 Proxy 类，Java 单继承已占用）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-rf3-4
    text: "Spring AOP 默认策略：有接口走 JDK 代理，无接口走 CGLIB"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

给接口动态造一个「替身」，所有调用先过你的一段逻辑：

```java
Foo proxy = (Foo) Proxy.newProxyInstance(loader, new Class[]{Foo.class},
    (p, method, args) -> {
        before();                    // 你的切面
        Object r = real.foo(args);   // 真正干活
        after();                     // 收尾
        return r;
    });
```

机理：JVM 运行时**生成字节码**造出 `$Proxy0 implements Foo`，它每个方法体只有一句——把参数打包**转发给你的 InvocationHandler.invoke**。限制：**只能代理接口**（代理类必须继承 Proxy 基类，Java 单继承名额被占了）——没接口就换 CGLIB（子类化）。

**术语速查**：代理类=运行时生成的替身 $ProxyN｜InvocationHandler=统一拦截入口｜切面=调用前后插入的逻辑

<!--advanced-->
sun.misc.ProxyGenerator（9+ java.lang.reflect.ProxyGenerator）产字节码，方法表缓存 hashCode/equals/toString 特判。Spring：JdkDynamicAopProxy 与 CglibAopProxy（Objenesis 绕构造器实例化）。方法内自调用不走代理（this 裸调用）是事务失效经典坑。
