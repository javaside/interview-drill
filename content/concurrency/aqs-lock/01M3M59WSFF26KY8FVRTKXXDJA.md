---
id: 01M3M59WSFF26KY8FVRTKXXDJA
blockId: concurrency/aqs-lock
relatedBlocks: []
question: AQS 的独占模式和共享模式有什么区别？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 读写锁是怎么同时用两种模式的？
keyPoints:
  - id: kp-aq5-1
    text: 独占：同一时刻一个线程持有（ReentrantLock、线程池 Worker）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEWBB5J408AHXNNYN8
      - 01M3M59WSF16SCYSM5EVS1C59W
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-aq5-2
    text: 共享：可多线程同时持有（Semaphore、CountDownLatch、读写锁的读锁）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEDGSJTK9Y680HTJJS
      - 01M3M59WSEWBB5J408AHXNNYN8
      - 01M3M59WSFN60YZ9DZ669FESZW
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-aq5-3
    text: 独占释放只唤醒队头一个；共享释放沿队列连续唤醒（传播）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEWBB5J408AHXNNYN8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-aq5-4
    text: 子类按需实现 tryAcquire/tryRelease 或 tryAcquireShared/tryReleaseShared 其一
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSEWBB5J408AHXNNYN8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
---

AQS 的两种**占用姿势**：

- **独占模式**：整个资源一次一个人用——tryAcquire 抢、tryRelease 放（ReentrantLock/Worker）。释放时**只唤醒队头一位**（下一个继承人）；
- **共享模式**：资源可以**多人同时拿**——tryAcquireShared（返回 ≥0 表示拿到）、tryReleaseShared（Semaphore 的许可、CountDownLatch 的计数、读锁）。释放时**沿队列连续唤醒**——只要后面的节点也是共享的，一路传下去（传播唤醒）。

读写锁是双面人：**写锁 = 独占模式**的语义、**读锁 = 共享模式**——同一套 AQS 骨架两种模式并存（state 高低位拆分计数）。

**术语速查**：独占=一次一人｜共享=多人并持｜传播唤醒=共享释放的连锁叫醒

<!--advanced-->
setHeadAndPropagate 的判断（h.waitStatus<0 或后继 shared）触发 doReleaseShared 循环；独占的 unparkSuccessor 只针对 head.next。读写锁 RRWL 即「一个 AQS 两副面孔」的官方示范。
