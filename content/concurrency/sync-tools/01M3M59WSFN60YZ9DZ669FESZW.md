---
id: 01M3M59WSFN60YZ9DZ669FESZW
blockId: concurrency/sync-tools
relatedBlocks:
  []
question: "Semaphore 是什么？怎么用？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 和线程池限流有什么区别？
keyPoints:
  - id: kp-st2-1
    text: "许可计数器：acquire 领许可（不足则阻塞），release 还许可"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'juc'
  - id: kp-st2-2
    text: "限流并发度：保护脆弱资源（DB 连接、外部接口）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'juc'
  - id: kp-st2-3
    text: "许可数可动态调整（release 多还则净增）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'juc'
  - id: kp-st2-4
    text: "acquire(n) 与 tryAcquire(timeout) 支持批量与限时"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'juc'
---

**信号量 = 发放手牌的排队机**：构造时放 N 个手牌，线程干活前 acquire() 领一个（没有就排队），干完 release() 还回来——**同时只有 N 个人在场上**。

典型用途：**保护第三方资源**——目标接口只抗得住 10 QPS？Semaphore(10) 圈住调用点。与线程池限流的差别：**线程池限的是「干活的人」，信号量限的是「同时在场的动作」**——线程可以有很多，但持牌进场的只有 N 个。

**术语速查**：许可=手牌｜限流=场上人数上限｜限时领取=tryAcquire 超时放弃

<!--advanced-->
基于 AQS 共享（state=permits，非公平默认允许插队抢刚还的牌——吞吐优先）。release 无持有校验（多还是净增，契约靠自觉）。Semaphore(1) 退化成互斥（但无重入无属主）。Guava RateLimiter 是速率限流，与并发数限流语义不同。
