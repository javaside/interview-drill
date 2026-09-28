---
id: 01M3M59WSF8JS0KFH32EQ2AXEC
blockId: concurrency/thread-pools
relatedBlocks:
  []
question: "shutdown 和 shutdownNow 的区别？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么推荐 shutdown + awaitTermination 组合？
keyPoints:
  - id: kp-tp4-1
    text: "shutdown：温和收摊——不接新任务，存量任务（含队列）跑完"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tp4-2
    text: "shutdownNow：立刻打烊——不接新任务、中断运行中线程、清空队列并返回未执行任务"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tp4-3
    text: "awaitTermination：设定时限候收摊完成（与 shutdown 成对使用）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tp4-4
    text: "返回的 List<Runnable> 是被抛弃的存量任务，调用方自行处置"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'
---

两种关店方式：

- **shutdown()** = 挂「打烊牌」：门口不接新客（抛 RejectedExecution），店里在吃的、排队的**都吃完**才熄灯；
- **shutdownNow()** = 拉电闸：不接新客 + **中断**正吃着的（运行中线程收到 interrupt）+ 排队的**全部请走**（未执行任务打包成 List 还给你）。

标准关闭姿势（温和 + 有时限）：

```java
pool.shutdown();
if (!pool.awaitTermination(30, SECONDS))   // 候 30 秒
    pool.shutdownNow();                     // 没收完就拉闸
```

**术语速查**：打烊=拒新不催旧｜拉闸=中断+清队列｜awaitTermination=限时候收｜遗留清单=被抛弃的任务

<!--advanced-->
shutdownNow 的 interrupt 只对响应中断的任务有效（CPU 密集不看纸条就跑完）。状态机 RUNNING→SHUTDOWN（shutdown）→STOP（now）→TIDYING→TERMINATED。drainQueue 保序返回。钩子 finalize 淘汰前的 terminated() 可覆写。进程退出前不关池 = 非守护线程吊住 JVM。
