---
id: 01M3M7HTMB8NEGPK8NWK3GJJ3A
blockId: jvm/class-loading
relatedBlocks: []
question: 什么是双亲委派？为什么这么设计？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 怎么打破双亲委派？
keyPoints:
  - id: kp-cl2-1
    text: 子加载器先委托父加载，父搞不定才自己加载
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-cl2-2
    text: 三层：启动（核心库）→扩展/平台→应用（classpath）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-cl2-3
    text: 保证核心类唯一与安全：java.lang.String 永远由启动加载器加载
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMB81HWVM0FJMDCK880
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-cl2-4
    text: 防篡改：自定义的 java.lang.String 顶替不了真 String
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMB81HWVM0FJMDCK880
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
---

**双亲委派**=「有事先问爹」：收到加载请求，**先层层上抛给最顶层的加载器**，父加载器搞不定的才自己动手。

三层结构：**启动类加载器**（Bootstrap，核心库 rt.jar）→ **平台加载器**（Platform，原扩展）→ **应用加载器**（App，你的 classpath）。

**为什么**：①**唯一性**——同一个类只被加载一次（java.lang.String 全 JVM 只有一份，instanceof 才有意义）；②**安全**——你写个带后门的 java.lang.String？委派链让它到不了启动加载器那层，防篡改。

**术语速查**：委托上抛=先问爹｜唯一性=一类一加载器｜防篡改=核心类不可顶替

<!--advanced-->
打破场景：SPI 的线程上下文加载器（JNDI/JDBC 父层调子层实现）、OSGi 网状、Tomcat 的 war 包隔离（每 webapp 独立 WebappClassLoader 先自己后父）。自定义加载器覆写 loadClass（委派逻辑）或 findClass（只管找，保委派）。
