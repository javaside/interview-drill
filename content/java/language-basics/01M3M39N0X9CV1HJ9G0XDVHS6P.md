---
id: 01M3M39N0X9CV1HJ9G0XDVHS6P
blockId: java/language-basics
relatedBlocks:
  []
question: "final、finally、finalize 分别是什么？"
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - finalize 为什么被废弃？
keyPoints:
  - id: kp-lb4-1
    text: "final 修饰：类不可继承 / 方法不可重写 / 变量只能赋值一次"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-lb4-2
    text: "finally：try 块的收尾，正常或异常都会执行（释放资源的固定位置）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-lb4-3
    text: "finalize：对象被 GC 回收前的回调钩子，已废弃（Java 9+ Deprecated）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-lb4-4
    text: "finally 不执行的三种情况：System.exit、JVM 崩溃、守护线程里的死循环"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

三个长得很像、毫无关系的东西：

- **final**（修饰符）：类=不许继承；方法=不许重写；变量=只许赋值一次（引用不可变≠对象不可变）。
- **finally**（语法）：try 的**收尾块**——不管出不出异常都执行，关流/释放锁的老位置（现代写法用 try-with-resources）。
- **finalize**（方法）：对象被回收前的「遗言」回调——执行时机不确定、可能拖垮 GC、能复活对象，**Java 9 起废弃**，替代品是 Cleaner 或显式 close。

**术语速查**：final=一次性赋值｜finally=必然收尾｜finalize=已废弃的遗言钩子

<!--advanced-->
final 字段有内存语义（构造器结束前的写入对正确发布后的读者可见，禁止重排序逃逸）。finally 吞异常风险：块内 return 会覆盖 try 的返回/异常。finalize 的替代 Cleaner 仍基于虚引用队列，语义弱化且非及时。
