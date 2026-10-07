---
id: 01M3M7HTMBHDFZQ4Z1E1JFTB3V
blockId: jvm/object-engine
relatedBlocks:
  - jvm/gc-basics
question: 方法调用有哪几种字节码指令？
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - invokestatic 为什么不需要接收者？
keyPoints:
  - id: kp-oe5-1
    text: invokestatic：静态方法（编译期锁定）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-oe5-2
    text: invokespecial：构造器/私有/super 调用（静态绑定）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-oe5-3
    text: invokevirtual：实例方法——按接收者实际类型虚分派
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0X0G14QQV3EYXSHC61
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-oe5-4
    text: invokeinterface：接口方法——接口表的迟绑定查找
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0X0G14QQV3EYXSHC61
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-oe5-5
    text: invokedynamic：动态调用点——lambda 与动态语言的基座
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
---

五条**调用指令**，绑定时机各异：

- **invokestatic**：静态方法——类一确定方法就确定（编译期锁定），连 this 都没有；
- **invokespecial**：构造器、private 方法、super 调用——这些**不该被重写分派**，静态绑定直呼；
- **invokevirtual**：普通实例方法——**按对象的真实类型**查虚方法表（vtable）分派（**多态的机器基础**）；
- **invokeinterface**：接口方法——按接口方法表查，首次慢一点（可内联缓存加速）；
- **invokedynamic**（indy）：调用点绑定一个 **CallSite**——运行时决定目标方法。**lambda 表达式**编译成 indy + LambdaMetafactory（不是匿名类！）。

**术语速查**：静态绑定=编译期定死｜虚分派=按真实类型查表｜indy=运行时再绑

<!--advanced-->
虚方法表在链接期准备（子表覆盖同签名槽位）；itable stub 缓存。内联缓存（monomorphic/bimorphic）与去虚化（CHA 激进内联）。indy 的 BootstrapMethod 与 CallSite 的 volatile 语义。
