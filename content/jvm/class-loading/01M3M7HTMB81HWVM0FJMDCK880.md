---
id: 01M3M7HTMB81HWVM0FJMDCK880
blockId: jvm/class-loading
relatedBlocks: []
question: 类的相等（同一个类）由什么决定？
cardType: atomic
appliesTo: Java 17+
frequency: high
followUps:
  - 同一个类被两个加载器加载会怎样？
keyPoints:
  - id: kp-cl4-1
    text: 全限定名 + 定义类加载器，两者都相同才是同一个类
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMB8NEGPK8NWK3GJJ3A
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS

misconceptions:
  - id: mc-cl4-1
    text: 全限定类名相同就是同一个类，由哪个加载器加载无关紧要
    why: 误解：定义类加载器参与类的身份判定，换了加载器就是另一个类，instanceof 都不认账
  - id: mc-cl4-2
    text: 同一个类被两个加载器加载时，JVM 会自动去重只留一份
    why: 误解：没有全局去重，两份类各自独立存在，对象互相赋值当场抛 ClassCastException
  - id: mc-cl4-3
    text: 热部署换成新版本类后，旧实例调方法会自动走新类的逻辑
    why: 误解：旧实例仍绑定旧 Class，新旧两套类并行共存，想走新逻辑只能重建对象
---

JVM 里「是不是同一个类」看**两样**：**全限定名**（叫什么）+ **定义类加载器**（谁加载的）。

`com.foo.Bar` 被加载器 A 和 B 各加载一次 = **两个不同的类**——`aBar instanceof bBar` 是 **false**、`ClassCastException` 从天而降。这是热部署/容器隔离的经典坑：同一份字节流，换了加载器就是换了「物种」。

**术语速查**：定义加载器=真正动手加载的那个｜物种=加载器决定类的身份

<!--advanced-->
类身份比较在 instanceof/显式转型/equals(Class) 的语义层生效。热部署的卸载条件极苛刻（类加载器+全部实例+Class 对象均可回收）——PermGen 时代易泄漏，元空间同理。Spring DevTools 的 restart ClassLoader 即利用双加载器并行新旧两套类。
