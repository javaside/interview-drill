---
id: 01M3M59WSFN60YZ9DZ669FESZW
blockId: concurrency/sync-tools
relatedBlocks: []
question: Semaphore 是什么？怎么用？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 和线程池限流有什么区别？
keyPoints:
  - id: kp-st2-1
    text: 许可计数器：acquire 领许可（不足则阻塞），release 还许可
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSFQ6DJYJ18QPFWZQBD
      - 01M3NE18CP02B6D8F0H2J4M6Q8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-st2-2
    text: 限流并发度：保护脆弱资源（DB 连接、外部接口）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNY7V9X1C3E5G7J9M1
      - 01M3NE18CP02B6D8F0H2J4M6Q8
      - 01M3NE18CP03D8F0H2J4M6Q8S0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-st2-3
    text: 许可数可动态调整（release 多还则净增）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CP02B6D8F0H2J4M6Q8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-st2-4
    text: acquire(n) 与 tryAcquire(timeout) 支持批量与限时
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CP02B6D8F0H2J4M6Q8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
misconceptions:
  - id: mc-sync2-1
    text: "acquire 凑不齐许可会立即失败返回 false，不挂起线程"
    why: "误解：acquire 不足就阻塞候牌；立刻给布尔的是无超时版 tryAcquire，限时的是超时版——三个 API 分清楚"
  - id: mc-sync2-2
    text: "release 必须先 acquire 过才能调，没领就还抛异常"
    why: "误解：release 只把许可计数加一，不查调用者领没领过；多还一张场上就多一张——信号量没有属主校验"
  - id: mc-sync2-3
    text: "Semaphore(1) 就是可重入的互斥锁：同一线程重复 acquire 也放行"
    why: "误解：它既无属主也无重入计数，同线程第二次 acquire 就把自己堵死；真要互斥语义上 ReentrantLock"
---

**信号量 = 发放手牌的排队机**：构造时放 N 个手牌，线程干活前 acquire() 领一个（没有就排队），干完 release() 还回来——**同时只有 N 个人在场上**。

典型用途：**保护第三方资源**——目标接口只抗得住 10 QPS？Semaphore(10) 圈住调用点。与线程池限流的差别：**线程池限的是「干活的人」，信号量限的是「同时在场的动作」**——线程可以有很多，但持牌进场的只有 N 个。

**术语速查**：许可=手牌｜限流=场上人数上限｜限时领取=tryAcquire 超时放弃

<!--advanced-->
基于 AQS 共享（state=permits，非公平默认允许插队抢刚还的牌——吞吐优先）。release 无持有校验（多还是净增，契约靠自觉）。Semaphore(1) 退化成互斥（但无重入无属主）。Guava RateLimiter 是速率限流，与并发数限流语义不同。
