---
id: 01M3M7HTM9QZ5RT4NKTV8K5415
blockId: jvm/memory-areas
relatedBlocks:
  []
question: "JVM 运行时数据区有哪几块？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 哪些区域线程共享、哪些私有？
keyPoints:
  - id: kp-ma1-1
    text: "堆：对象实例的主战场，线程共享，GC 的核心工作区"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-ma1-2
    text: "虚拟机栈：每线程一份，栈帧存局部变量表与操作数栈"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-ma1-3
    text: "方法区（元空间）：类信息、常量、静态变量；落在本机内存"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-ma1-4
    text: "程序计数器：当前线程执行的字节码行号，唯一无 OOM 区域"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-ma1-5
    text: "本机方法栈：服务 native 方法"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
---

按「**谁的**」分两组记：

**线程私有**（人手一份，随线程生灭）：
- **程序计数器**：记着「我执行到哪条字节码」——线程切换回来接着跑的路标。唯一**永不 OOM** 的区域；
- **虚拟机栈**：方法调用的轨迹——每调一个方法压一个**栈帧**（局部变量、操作数栈）。-Xss 设大小，钻太深就 StackOverflowError；
- **本机方法栈**：同上，但服务 native 方法。

**线程共享**：
- **堆**：new 出来的对象全在这——GC 的主战场；
- **方法区**：类的元数据——JDK 8 起叫**元空间**，搬到了**本机内存**（告别永久代的 PermGen OOM）。

另有一块编外的**直接内存**（DirectByteBuffer 用），不在五区内但同样吃机器内存。

**术语速查**：栈帧=一次方法调用的快照｜元空间=方法区的本机内存形态｜直接内存=JVM 堆外的机器内存

<!--advanced-->
JVMS 2.5 规范五区；元空间默认不限（MaxMetaspaceSize 设顶）。栈 SOE 与栈帧深度/局部变量数相关。字符串常量池 7+ 入堆（intern 的旧 PermGen 事故绝迹）。PC 对 native 方法为 undefined。
