---
id: 01M3M7HTMBGBZPZS0NQDQD6AMZ
blockId: jvm/class-loading
relatedBlocks: []
question: 怎么打破双亲委派？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - Tomcat 为什么要打破？
keyPoints:
  - id: kp-cl3-1
    text: 重写 loadClass：改掉「先委托后自找」的流程本身
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-cl3-2
    text: 线程上下文类加载器：让父层代码能借子层加载器（SPI/JDBC 的实现发现）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-cl3-3
    text: OSGi 与 Web 容器：模块化/应用隔离要求各自加载各自的类
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMB81HWVM0FJMDCK880
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-cl3-4
    text: 重写 findClass 只影响「怎么找」不破委派——推荐的扩展方式
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
---

两条路数：

1. **真打破——重写 loadClass()**：委派逻辑就在这个方法里（先 parent、后自己），覆写它就改了流程。**Tomcat** 是代表：每个 webapp 一个独立加载器**先自己加载**（应用隔离——两个 war 各自的 UserService 互不干扰），加载不到才走父；
2. **绕道——线程上下文类加载器（TCCL）**：核心库（JDBC 的 DriverManager 在启动层）要用 classpath 上的驱动实现——父层加载器**够不着**子层的类。TCCL 让核心代码「借」当前线程的应用加载器去加载（SPI 的 ServiceLoader 同理）。

**规矩**：只想加个加载路径→重写 **findClass**（委派不动）；要改优先级/隔离→才动 loadClass。

**术语速查**：loadClass=委派流程所在｜findClass=只管找字节流｜TCCL=父借子的通道

<!--advanced-->
破坏的历史节点：JNDI（1.2 TCCL 引入）、自定义流（1.2 前重写 loadClass）、OSGi（Bundle 形成网状委派）。线程默认 TCCL=应用加载器。Launcher 的 AppClassLoader 源码即 loadClass 的 synchronized+委派样板。
