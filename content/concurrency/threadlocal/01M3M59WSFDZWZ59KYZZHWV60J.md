---
id: 01M3M59WSFDZWZ59KYZZHWV60J
blockId: concurrency/threadlocal
relatedBlocks: []
question: ThreadLocal 的典型使用场景？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - traceId 为什么用 ThreadLocal 存？
keyPoints:
  - id: kp-tl3-1
    text: 按线程隔离的工具实例：SimpleDateFormat、Random（非线程安全者的白手套）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tl3-2
    text: 传递上下文：用户身份、traceId、事务上下文（避免层层传参）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSFA2RSG2K6KNQH05AB
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tl3-3
    text: 数据库连接/会话绑定（早期事务管理的实现方式）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tl3-4
    text: 替代方案：上下文参数显式传递（不可见性换可测性）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

两大类场景：

1. **非线程安全工具的按线程私有化**：`SimpleDateFormat` 一个字段的日历被并发踩——每线程一份 `static ThreadLocal<SDF>`，各用各的永不打架（比每次 new 省、比加锁快）；
2. **隐式上下文**：traceId、当前用户、事务——**入口设一次**（过滤器），**任意深处取用**，不必每层方法加参数透传。

代价与克制：**隐式依赖**让调用链不可见（测试要造上下文、异步要搬家）——能用参数显式传就显式传，跨方法边界太多才上 ThreadLocal。

**术语速查**：私有化=每线程一份实例｜隐式上下文=不传参的暗线｜搬家=异步时复制（TTL）

<!--advanced-->
SDF 高并发三案：ThreadLocal 版（每线程一份）、DateTimeFormatter（无状态线程安全，现代正解）、fastjson 的 ThreadLocal 缓冲复用。链路追踪的 in-process 传播 + 跨进程 header；MDC 即 logback 的 ThreadLocal 封装。异步场景的上下文丢失催生 TransmittableThreadLocal（池化线程的任务装饰复制）。
