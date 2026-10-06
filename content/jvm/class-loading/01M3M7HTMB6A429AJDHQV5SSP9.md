---
id: 01M3M7HTMB6A429AJDHQV5SSP9
blockId: jvm/class-loading
relatedBlocks: []
question: 什么是类的初始化时机？
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - static final 常量为什么不触发初始化？
keyPoints:
  - id: kp-cl5-1
    text: 主动引用才初始化：new、读写静态字段、调用静态方法
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-cl5-2
    text: 反射调用、初始化子类时父类先初始化、main 所在类
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-cl5-3
    text: 被动引用不初始化：引用父类静态、创建数组、引用编译期常量
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-cl5-4
    text: 接口初始化：仅在使用其成员时，初始化接口不触发父接口
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
---

类**不是**加载了就初始化——**只有「主动引用」才点火**跑 `<clinit>`：

**主动（会初始化）**：new 实例；读写**非 final** 静态字段；调用静态方法；反射；初始化子类连带父类先；main 所在类。

**被动（不初始化）**：
- 子类引用**父类**的静态字段——只初始化父类；
- `Sub[] arr = new Sub[10]`——数组构造不触发 Sub；
- 引用 **static final 编译期常量**——它在**调用方的常量池**里就有一份（宏替换），压根不用碰定义类。

**术语速查**：主动引用=点火的动作｜被动引用=路过不算｜编译期常量=调用方自带副本

<!--advanced-->
JLS 12.4.1 的六种主动引用。HotSpot 的 -Xlog:class+init 可观测。常量的 ConstantValue 属性在准备期赋值（跳过 clinit 的宏展开）。接口字段默认 public static final，其 <clinit> 的触发更保守。
