---
id: 01M3M7HTMAPR9TR7P2SKK61TTM
blockId: jvm/gc-basics
relatedBlocks: []
question: 四种引用的区别？
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - ThreadLocal 的键用的哪种？
keyPoints:
  - id: kp-gb2-1
    text: 强引用：new 出来的普通引用——不可达绝不回收
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gb2-2
    text: 软引用 SoftReference：内存不足才回收——缓存的第一档
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gb2-3
    text: 弱引用 WeakReference：下次 GC 必回收——ThreadLocal 的键
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-gb2-4
    text: 虚引用 PhantomReference：不影响生死，只做回收通知
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
---

引用的**强度**=「求 GC 放过它」的力度，从硬到软排：

- **强引用**：普普通通的赋值——只要可达就**绝不回收**；
- **软引用**：**内存不够了才牺牲**（当缓存：宽裕时命中、紧张时让路）；
- **弱引用**：**下次 GC 一律带走**（ThreadLocalMap 的键——ThreadLocal 没了键自动断）；
- **虚引用**：形同虚设——**不影响生死**，只在被回收时收到通知（直接内存的 Cleaner 靠它知道何时归还本机内存）。

**术语速查**：软=内存不够才放｜弱=下次必收｜虚=只报丧不管生死

<!--advanced-->
软引用回收时机：抛 OOM 前的最后挣扎（SoftRefLRUPolicyMSPerMB 调豁免期）。弱引用与 ReferenceQueue 联动（WeakHashMap）。虚引用必须配队列；Cleaner 即 PhantomReference+Runnable。
