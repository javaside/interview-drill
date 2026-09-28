---
id: 01M3M7HTMBQ2GQWERJME800QH7
blockId: jvm/object-engine
relatedBlocks:
  - jvm/gc-basics
question: "对象的内存布局？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 一个空对象占多少字节？
keyPoints:
  - id: kp-oe2-1
    text: "对象头 Mark Word：哈希/GC 年龄/锁状态位（锁升级的主舞台）"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-oe2-2
    text: "对象头类型指针：指向类元数据（压缩指针 4 字节）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-oe2-3
    text: "实例数据：字段按类型排序排列（longs/doubles 优先的对齐策略）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-oe2-4
    text: "对齐填充：补齐到 8 字节整数倍"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
---

一个对象在堆里的**三段结构**：

```
[ 对象头 ]  Mark Word（8B：哈希/锁位/年龄）+ 类型指针（4B 压缩开启）
[ 实例数据 ]  字段们（按宽度与 HotSpot 的字段重排策略排放）
[ 对齐填充 ]  补到 8 的倍数
```

经典答案：**new Object() 占 16 字节**——8B MarkWord + 4B 压缩类型指针 + 4B 填充。**Mark Word 是多面间谍**：无锁存 hashCode、轻量锁存 Lock Record 指针、重量锁存 monitor 指针——锁升级的状态就记在这里（synchronized 块的核心）。

**术语速查**：Mark Word=8 字节的多状态头｜类型指针=指向类户口｜8 字节对齐=对象的基本格

<!--advanced-->
JOL（Java Object Layout）可实测布局。压缩指针（CompressedOops）4B 管 32GB；超 32G 关闭后指针 8B。字段重排：同宽聚集+父类在前；volatile 字段的相邻重排受限。数组额外 4B 的 length 头。
