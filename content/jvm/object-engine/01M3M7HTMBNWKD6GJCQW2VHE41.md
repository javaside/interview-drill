---
id: 01M3M7HTMBNWKD6GJCQW2VHE41
blockId: jvm/object-engine
relatedBlocks:
  - jvm/gc-basics
question: 对象的创建过程？
cardType: sequence
appliesTo: Java 17+
frequency: high
followUps:
  - 指针碰撞和空闲列表的区别？
keyPoints:
  - id: kp-oe1-1
    text: 类加载检查：没初始化的类先触发加载初始化
    public: true
    order: 1
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMB6A429AJDHQV5SSP9
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-oe1-2
    text: 分配内存：TLAB 命中则无锁分配，否则 Eden CAS
    public: true
    order: 2
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-oe1-3
    text: 零值初始化：字段全部置默认值
    public: true
    order: 3
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-oe1-4
    text: 设对象头：类型指针/哈希/GC 分代年龄
    public: true
    order: 4
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBQ2GQWERJME800QH7
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-oe1-5
    text: 执行 <init>：构造方法（字段赋真值）
    public: true
    order: 5
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
---

`new Foo()` 在 JVM 内部的**五步流水**（按序排）：

1. **类检查**：Foo 没初始化？先走类加载（加载→…→初始化）；
2. **分内存**：常规对象在 **Eden** 划一块——先试自己的 **TLAB**（线程私有缓冲，**无锁**极速），不够则 Eden 上 CAS 抢；
3. **置零值**：整块内存清零（字段全是默认值——`int` 是 0 不是 null 悬空）；
4. **设对象头**：类型指针（它是谁的实例）、 hashCode、GC 年龄……元数据上牌；
5. **跑构造**：执行 `<init>`——字段赋真值、构造逻辑跑完，对象才算「成人」。

**术语速查**：TLAB=线程私有的分配特区｜零值=字段先填默认｜对象头=身份证+户口页

<!--advanced-->
分配方式取决于堆是否规整：规整（G1/整理后）用指针碰撞 bump-the-pointer；碎片（CMS 清除后）用 free list。逃逸分析下的标量替换可跳过整个分配（栈上拆散）。大对象直入老年代（PretenureSizeThreshold）。
