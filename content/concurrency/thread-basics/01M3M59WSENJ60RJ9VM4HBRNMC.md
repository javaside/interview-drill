---
id: 01M3M59WSENJ60RJ9VM4HBRNMC
blockId: concurrency/thread-basics
relatedBlocks:
  []
question: "守护线程（daemon）是什么？"
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - 为什么不能在守护线程里写文件？
keyPoints:
  - id: kp-tb4-1
    text: "为用户线程服务的后台线程：JVM 只剩守护线程时直接退出"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tb4-2
    text: "setDaemon(true) 必须在 start 前调用"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tb4-3
    text: "守护线程被 JVM 粗暴终止：不跑 finally、不做清理，慎放关键资源"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tb4-4
    text: "典型用途：GC 线程、心跳上报、日志刷盘这 类「没了也无妨」的工作"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'
---

线程分两种身份：

- **用户线程**：正主。JVM 会陪所有用户线程走完才退出；
- **守护线程（daemon）**：仆从。**最后一个用户线程一结束，JVM 直接关灯走人**——守护线程当场蒸发，不管跑到哪（finally 不执行、流不关）。

所以守则：**守护线程只干「中断了也无所谓」的活**（心跳、指标上报）；写文件、发关键消息这种半途而废会留脏数据的活，别放守护线程。`setDaemon(true)` 必须在 `start()` 前设，否则抛异常。

**术语速查**：用户线程=JVM 陪跑的正主｜守护线程=随 JVM 撤退蒸发的后台｜粗爆终止=无 finally 无清理

<!--advanced-->
exit 序列：停所有线程（daemon 直接弃）→ runFinalizersOnExit（默认关）→ 卸类加载器。与 shutdown hook 的区别：hook 在正常退出前被有序执行，daemon 线程无此礼遇。线程池的工作线程默认非守护（JDK 默认工厂），自定义工厂可设守护——须确保池已 shutdown。
