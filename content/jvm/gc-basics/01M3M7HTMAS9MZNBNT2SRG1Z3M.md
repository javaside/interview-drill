---
id: 01M3M7HTMAS9MZNBNT2SRG1Z3M
blockId: jvm/gc-basics
relatedBlocks:
  []
question: "怎么判断对象可以回收？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 引用计数为什么不被 JVM 采用？
keyPoints:
  - id: kp-gb1-1
    text: "可达性分析：从 GC Roots 出发，引用链够不着的即垃圾"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-gb1-2
    text: "GC Roots：栈帧局部变量、静态变量、常量、JNI 引用"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-gb1-3
    text: "引用计数：循环引用计数永不归零——主流 JVM 弃用"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-gb1-4
    text: "不可达并非立刻死：软/弱/虚引用与 finalize 留了缓刑通道"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
---

判定标准一句话：**从根出发摸不着的，就是垃圾**。

**可达性分析**：定一批 **GC Roots**（各线程栈帧局部变量、静态变量、字符串常量、JNI 引用——这些是「活着」的锚点），沿引用链往下摸——**够不着的**整个子图都是垃圾（互相抱团但整体悬空的「孤岛」照样收）。

为什么不用**引用计数**（数几个引用指向我，归零即收）？**循环引用**是死穴：A 指 B、B 指 A，谁也不归零——HotSpot 干脆弃用。

**术语速查**：GC Roots=活着的世界锚点｜引用链=从根到对象的路径｜孤岛=互引但整体悬空

<!--advanced-->
OopMap 记录栈/寄存器引用，安全点配合扫描。四类引用强度见下一张。finalize 已废弃（Cleaner 替代）。三色标记的并发漏标由 SATB/增量更新解。
