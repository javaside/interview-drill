---
id: 01M3M7HTMBMG22BR4930FJMMAA
blockId: jvm/jvm-tools
relatedBlocks:
  []
question: "内存泄漏怎么排查？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 内存泄漏和内存溢出的区别？
keyPoints:
  - id: kp-jt2-1
    text: "现象：Full GC 后老年代只升不降、GC 间隔越来越短"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-jt2-2
    text: "dump 堆（jmap 或 HeapDumpOnOutOfMemoryError）交 MAT"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-jt2-3
    text: "MAT 看 Dominator Tree 与 Leak Suspects：谁霸着内存不放"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-jt2-4
    text: "常见根因：静态集合只进不出、ThreadLocal 不 remove、监听器不注销、连接不关"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
---

**排查流水线**：

1. **确诊**：jstat 观察——Full GC 后老年代**不回落**、GC 越来越勤 = 泄漏（不是单纯不够用）；
2. **留证**：`-XX:+HeapDumpOnOutOfMemoryError`（OOM 自动 dump）或 jmap 手动导；
3. **验尸**：MAT（Eclipse Memory Analyzer）——**Dominator Tree**（谁牵着一坨内存）+ **Leak Suspects**（自动出嫌疑报告）——顺着最大保留集（Retained Set）找到「谁在拽着垃圾不让走」；
4. **对因**：静态 Map 只进不出 / ThreadLocal 没 remove / 监听器没注销 / 连接没 close / 类加载器泄漏。

**术语速查**：只升不降=泄漏的指纹｜Dominator=内存的把持者｜Retained=松手能释放的总量

<!--advanced-->
泄漏≠溢出：泄漏（该回收的被引用着）最终导致溢出（装不下）；溢出也可能只是容量小。弱引用/软引用误用（缓存无界）、Finalizer 队列堆积是隐性根因。jcmd GC.class_histogram 的 live 过滤。
