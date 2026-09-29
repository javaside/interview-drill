---
id: 01M3M59WSFCP7EETZQRW5PP56N
blockId: concurrency/thread-pools
relatedBlocks:
  []
question: "任务提交后的执行流程是什么？"
cardType: sequence
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么先排队后扩编？
keyPoints:
  - id: kp-tp2-1
    text: "线程数 < core：直接新建核心线程执行本任务"
    public: false
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tp2-2
    text: "core 满：任务进 workQueue 排队"
    public: false
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tp2-3
    text: "队列满且线程 < max：新建非核心线程立即执行"
    public: false
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tp2-4
    text: "队列满且线程 = max：执行拒绝策略"
    public: false
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'
---

任务进池的**四级阶梯**（按发生顺序排）：

```
新任务 → ① 线程 < core？→ 新建核心线程跑它
       → ② core 满？→ 进队列排队
       → ③ 队列满 且 < max？→ 扩非核心线程跑它
       → ④ 队列满 且 = max？→ 拒绝策略处置
```

反直觉点在 **②先排队、③才扩编****：**「宁可攒着也不用临时工」**——因为建线程贵、销毁也贵，队列（内存）比线程（OS 资源）便宜。想要「先扩编后排队」的语义得换队列实现（如 Tomcat 的定制 TaskQueue 反转 offer）。

**术语速查**：四级阶梯=core→queue→max→reject｜先排队后扩编=攒内存不攒线程

<!--advanced-->
addWorker 的 CAS ctl + 独享 mainLock 一致性；worker 即 AQS 独占壳+线程循环 getTask()。SynchronousQueue 的 offer 恒无缓冲 → newCachedThreadPool 语义（②③折叠：队列永空）。LinkedBlockingQueue 无界的 offer 恒成功 → fixedPool 的 max 恒闲置（③④永不触达）。
