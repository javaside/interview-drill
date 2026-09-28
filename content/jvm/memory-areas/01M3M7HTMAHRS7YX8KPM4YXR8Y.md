---
id: 01M3M7HTMAHRS7YX8KPM4YXR8Y
blockId: jvm/memory-areas
relatedBlocks:
  []
question: "直接内存是什么？和堆内存有什么区别？"
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - NIO 为什么爱用 DirectByteBuffer？
keyPoints:
  - id: kp-ma5-1
    text: "JVM 堆外的本机内存块，DirectByteBuffer 分配，不受 -Xmx 约束"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-ma5-2
    text: "堆内数组与 OS 交互要先拷到本机内存——直接内存省掉这次拷贝"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-ma5-3
    text: "NIO 与 Netty 的零拷贝基座：Socket 读写直接落在直接内存"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-ma5-4
    text: "释放靠 Cleaner 异步回收——分配贵，适合池化复用"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
---

**直接内存** = 绕过 JVM 堆、直接向操作系统要的**本机内存块**（ByteBuffer.allocateDirect）。

它解决一次多余的搬运：**堆内 byte 数组**与 socket/文件交互时，JVM 得先把它**拷贝到本机内存**（OS 不认 JVM 堆地址）——直接内存**生在终点**，省掉这一拷（NIO/Netty 高性能的**零拷贝基座**）。

代价与纪律：分配/释放比堆贵（Cleaner 异步回收），适合**大块、复用**（Netty 池化缓冲）；容量不受 -Xmx 限（-XX:MaxDirectMemorySize 单独设顶）——**物理内存被它悄悄吃光**是容器里的经典暗坑。

**术语速查**：直接内存=堆外的本机缓冲｜零拷贝=数据不落地中转｜池化=反复复用大缓冲

<!--advanced-->
DirectByteBuffer 的 address 字段存本机地址；堆内外拷贝的根因：GC 会移动对象（堆地址不稳）而 OS 的 DMA 需要稳定地址。容器被 OOM-kill 排查须核对 RSS 与 MaxDirectMemorySize。
