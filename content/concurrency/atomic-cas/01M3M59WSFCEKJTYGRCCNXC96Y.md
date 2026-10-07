---
id: 01M3M59WSFCEKJTYGRCCNXC96Y
blockId: concurrency/atomic-cas
relatedBlocks: []
question: 原子类是怎么实现的？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么 AtomicReference 也常用？
keyPoints:
  - id: kp-ac1-1
    text: CAS 自旋 + volatile 读：读可见、写原子
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEK3CJX64G4RDE10ED
      - 01M3M59WSEP0BGWBNR944YKH0G
      - 01M3M59WSF16SCYSM5EVS1C59W
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-ac1-2
    text: incrementAndGet：循环里 CAS 旧值到旧值加一，失败重读重试
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEP0BGWBNR944YKH0G
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-ac1-3
    text: getAndAccumulate 与 getAndUpdate：任意函数的 CAS 通用形态（8+）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEP0BGWBNR944YKH0G
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-ac1-4
    text: LongAdder：热点计数不在这里——分散格子求和（空间换冲突）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEP0BGWBNR944YKH0G
      - 01M3M59WSFMHAG2JTWE04XH3N0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-ac1-5
    text: getIncrement 与 getAndSet 皆为自旋封装的单变量原语
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEP0BGWBNR944YKH0G
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
---

原子类 = **volatile 读 + CAS 写**的组合拳：

- 读：volatile——永远最新值；
- 写：读旧值 → 算新值 → CAS(旧, 新)，**失败说明有人抢先**——重读重试（自旋），直到成功。

AtomicInteger.incrementAndGet() 就是这个圈的封装。8+ 的 getAndAccumulate(x, (old, x) -> …) 把「算新值」开放成任意函数——无锁更新的通用件。AtomicReference 同理泛化到任意对象：**单变量多线程互抢写入，赢家的值完整可见**（并发更新配置/状态对象）。

**术语速查**：自旋=失败立刻重试｜泛化=任意类型任意函数的无锁更新｜热点=超高频单点（该上 Adder）

<!--advanced-->
Unsafe（17+ VarHandle）的 compareAndSet 是 hotspot intrinsics。字段级原子：AtomicIntegerFieldUpdater/VarHandle 直接 CAS 普通字段（免包装对象）。AQS/CHM/并发集合底层同源这把 CAS。
