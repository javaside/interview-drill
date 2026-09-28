---
id: 01M3M7HTMBPQKZ8V2N78WW7RWH
blockId: jvm/gc-basics
relatedBlocks:
  []
question: "什么是安全点（safepoint）？"
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - 为什么 long 循环会让 GC 卡住？
keyPoints:
  - id: kp-gb4-1
    text: "线程可以安全停车接受 GC 检查的位置：方法调用/循环回边/异常跳转"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-gb4-2
    text: "GC 发起时全线程跑到最近安全点停机（STW 的起点）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-gb4-3
    text: "OopMap 在安全点记录栈与寄存器里的引用位置"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-gb4-4
    text: "可数 int 长循环没有安全点——其他线程全在候它"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
---

GC 要扫描引用，但线程**不能在任意指令处被打断**（寄存器/栈里引用状态不明）。**安全点**=JVM 挑好的「**可以安全停车**」的位置。

GC 一发起：**所有线程跑到最近的安全点停下**（STW 的「世界静止」即全员到站）——每点的 **OopMap** 记着「此刻哪些位置是引用」，roots 扫描照图索骥。

经典暗坑：**不含安全点的紧凑长循环**（数 int 到十亿）——循环里的线程**到不了站**，其他所有线程停在各自安全点**干候**——系统莫名卡几秒的元凶。

**术语速查**：安全点=可停车的检查站｜OopMap=引用位置的地图｜停机=全员到站才开工

<!--advanced-->
测试页轮询实现（读内存页触发 trap）。可数循环被 JIT 视为短循环不插 safepoint——-XX:+UseCountedLoopSafepoints 缓解。安全区域（safe region）覆盖阻塞中的线程（睡醒先确认出区才继续）。
