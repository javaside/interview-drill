---
id: 01M3M7HTMB90FZKSVG7C5TG9XK
blockId: jvm/class-loading
relatedBlocks:
  []
question: "类加载的过程有哪几步？"
cardType: sequence
appliesTo: Java 17+
frequency: high
followUps:
  - <clinit> 的线程安全靠什么保证？
keyPoints:
  - id: kp-cl1-1
    text: "加载：按全限定名读字节流，生成方法区的类结构与堆中的 Class 对象"
    public: true
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-cl1-2
    text: "验证：文件格式/元数据/字节码/符号引用四道安检"
    public: true
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-cl1-3
    text: "准备：静态变量分配内存并置零值（final 常量在此直接赋值）"
    public: true
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-cl1-4
    text: "解析：符号引用转直接引用（懒执行：首次用到才发生）"
    public: true
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-cl1-5
    text: "初始化：执行 <clinit>（静态变量赋值与静态块合并而成）"
    public: true
    order: 5
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
---

类的加载到就绪，按发生顺序排五步（把下面排对）：

1. **加载**：按全限定名把字节流读进来（jar/网络/动态生成皆可）——方法区建类结构、堆里造 Class 对象；
2. **验证**：四道安检（文件格式→元数据→字节码→符号引用）——防恶意/损坏的字节流伤 JVM；
3. **准备**：**静态变量**分配内存并**置零值**（`static int a=1` 此刻 a=0！final 编译期常量例外直接赋 1）；
4. **解析**：符号引用（"java/lang/String"）换直接引用（内存地址）——可懒执行；
5. **初始化**：跑 **`<clinit>`**（静态赋值+静态块按源码顺序合并）——**这才是「类被真正激活」**。

**术语速查**：准备=置零值不是赋值｜clinit=静态初始化的合成方法｜懒解析=用到才转地址

<!--advanced-->
六种主动引用触发初始化（new/静态访问/反射/子类初始化/main 类等）；被动引用（子类引用父类静态、数组创建、常量池引用）不触发。<clinit> 由 JVM 加锁保证线程安全（类初始化锁）——静态单例的 HOLDER 模式正靠它。
