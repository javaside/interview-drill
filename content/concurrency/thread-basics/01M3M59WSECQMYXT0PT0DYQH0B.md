---
id: 01M3M59WSECQMYXT0PT0DYQH0B
blockId: concurrency/thread-basics
relatedBlocks: []
question: start() 和 run() 的区别？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么 Thread 不能重复 start？
keyPoints:
  - id: kp-tb2-1
    text: start 向 JVM 申请新线程，由它回调 run——实现并发
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb2-2
    text: 直接调 run 只是当前线程里的普通方法调用，毫无并发
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb2-3
    text: 一个 Thread 对象只能 start 一次（IllegalThreadStateException）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb2-4
    text: start 内部走 native start0，把 this 挂到新线程的执行入口
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

最容易踩的入门坑：

- `t.start()`：向 JVM 报备「开个新线程」，新线程的入口就是 `t.run()`——**真正的并发**；
- `t.run()`：就是普普通通的方法调用，在**当前线程**里顺序执行——写得像多线程，跑得像单线程。

而且一个 Thread 对象**只能 start 一次**——它内部记录着线程状态，重复 start 抛 `IllegalThreadStateException`。想再跑一遍？新建 Thread 或用线程池。

**术语速查**：start=申请并发执行流｜run=普通方法｜一次性=Thread 状态机不可回退

<!--advanced-->
start0 是 native：进程侧创建 OS 线程并设置入口回调 Java 层 run。线程状态 NEW→RUNNABLE 的迁移由 JVM 内部完成，重复 start 在状态检查处拒绝。ExecutorService 语义下「任务重跑」对应重新 submit Runnable（任务对象可复用，Thread 不行）。
