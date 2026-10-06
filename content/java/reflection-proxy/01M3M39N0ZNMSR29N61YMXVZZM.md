---
id: 01M3M39N0ZNMSR29N61YMXVZZM
blockId: java/reflection-proxy
relatedBlocks: []
question: 获取 Class 对象的方式有哪些？
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - Class.forName 和 ClassLoader.loadClass 的区别？
keyPoints:
  - id: kp-rf1-1
    text: 类名.class：编译期已知类型时最简洁
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-rf1-2
    text: 对象.getClass()：运行时拿实例的真实类型（含子类）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-rf1-3
    text: Class.forName(全限定名)：按名字加载（JDBC 驱动注册的经典写法）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-rf1-4
    text: 三种方式拿到的是同一个 Class 实例（JVM 每类一份）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

运行时拿到「类型的身份证（**Class 对象**」的三条路：

1. `String.class`——写代码时就知道类型，静态最省；
2. `s.getClass()`——手上有个实例，问它是谁（多态下是**真实类**）；
3. `Class.forName("com.mysql.cj.jdbc.Driver")`——只有个**字符串名字**，运行时加载（JDBC 老式驱动注册）。

三种方式对同一个类拿到的是**同一份 Class**（JVM 每类只一份，锁 synchronized(String.class) 也就是这个对象）。

**术语速查**：Class 对象=类型的运行时元数据｜全限定名=带包路径的完整类名｜每类一份=全 JVM 单例

<!--advanced-->
forName 双参重载可控制初始化（initialize=false 只加载不跑静态块）；loadClass 默认不链接。类加载器委派下同一类名可能多份 Class（不同 loader——Web 容器类隔离基础）。getCanonicalName 与 getName 在内部类/数组上的差异。
