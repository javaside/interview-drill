---
id: 01M3M59WSEK3CJX64G4RDE10ED
blockId: concurrency/volatile-jmm
relatedBlocks: []
question: volatile 保证什么、不保证什么？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - i++ 加了 volatile 为什么还是错的？
keyPoints:
  - id: kp-vj1-1
    text: 保证可见性：写立即刷回主存，读强制拉最新值
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj1-2
    text: 保证有序性：读写点插入内存屏障，禁止指令重排越界
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj1-3
    text: 不保证原子性：count++ 这类复合操作照样丢更新
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj1-4
    text: 单次读写天然原子的类型（long/double 除外历史）加 volatile 才是安全的标志位用法
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

volatile 的两保一不保：

- **保可见**：一个线程写了，别人**立刻**看得见（强制走主存，绕开各自的缓存副本）；
- **保有序**：volatile 读写点是栅栏——重排与优化不得跨越；
- **不保原子**：`count++` 是「读→加→写」三步——两个线程同时读到 9、各加成 10、先后写回——**丢一次更新**。volatile 管不住三步中间被人插队。

所以 volatile 的正确用法：**状态标志**（`volatile boolean running`）、单写多读的发布（配置引用）。计数请用 `AtomicLong` 或加锁。

**术语速查**：可见性=写立即可见｜有序性=禁止越界重排｜原子性=三步不可拆——volatile 缺这张

<!--advanced-->
JMM 对 volatile 的定义：store/load 屏障协议 + happens-before 边（volatile 写 先行发生于 后续读）。long/double 的非原子历史（JLS 17.7）由 volatile 兜底。复合赋值（++、+=）在字节码即 getfield/运算/putfield 三段，volatile 不提供 read-modify-write 原子性。
