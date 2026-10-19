---
id: 01M3M59WSFQ6DJYJ18QPFWZQBD
blockId: concurrency/sync-tools
relatedBlocks: []
question: 怎么实现一个生产者消费者队列？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - put 和 offer 的区别？
keyPoints:
  - id: kp-st4-1
    text: 首选 BlockingQueue：put 与 take 自带满阻塞与空阻塞
    public: true
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
  - id: kp-st4-2
    text: ArrayBlockingQueue 有界（生产推荐）；LinkedBlockingQueue 可设界
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
  - id: kp-st4-3
    text: SynchronousQueue 零容量直递（一手交钱一手交货）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
  - id: kp-st4-4
    text: PriorityBlockingQueue 按优先级出队；DelayQueue 到期才可取
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CP02B6D8F0H2J4M6Q8
      - 01M3NE18CP03D8F0H2J4M6Q8S0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
misconceptions:
  - id: mc-sync4-1
    text: "LinkedBlockingQueue 不设容量也安全，消费跟不上时 JVM 会替生产端限流"
    why: "误解：不设界就是无界雷区，生产快过消费只进不出直到 OOM；背压要靠有界队列的 put 满阻塞"
  - id: mc-sync4-2
    text: "SynchronousQueue 容量为一：可以先塞一个占位，消费者随后再取"
    why: "误解：它是零容量直递——put 必须候到有人 take 当场交接，没有「先垫一个」的格子"
  - id: mc-sync4-3
    text: "offer 与 put 只是两个名字，队列满时表现一模一样"
    why: "误解：offer 满了立刻交还 false 走人（超时版限时）；put 才排队候位——背压语义认的是 put"
---

生产者消费者的**队列选型**：

- **ArrayBlockingQueue(n)**：数组有界——满则 put 阻塞、空则 take 阻塞，背压天然成立（生产推荐）；
- **LinkedBlockingQueue**：链表可设界（不设即无界雷区）；
- **SynchronousQueue**：**零容量**——put 必须候到有人 take（直接握手，cachedPool 的心脏）；
- **PriorityBlockingQueue / DelayQueue**：按优先级/到期时间出队。

API 口径：put（**满则阻塞**，有背压）/ offer(timeout)（限时塞）/ take（空则阻塞）/ poll(timeout)（限时取）。

**术语速查**：有界=有上限（背压水位）｜零容量=直递握手｜阻塞 API=满了空了的自觉排队

<!--advanced-->
ABQ 单锁双 Condition（notEmpty/notFull）；LBQ 双锁（putLock/takeLock）+ 原子计数。TransferQueue（LinkedTransferQueue）= SQ 与 LBQ 合体（tryTransfer 直递/队列缓冲可切换）。
