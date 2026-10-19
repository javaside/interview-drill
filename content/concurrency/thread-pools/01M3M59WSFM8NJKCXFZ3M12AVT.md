---
id: 01M3M59WSFM8NJKCXFZ3M12AVT
blockId: concurrency/thread-pools
relatedBlocks: []
question: 为什么不推荐 Executors 的快捷工厂？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - OOM 是怎么发生的？
keyPoints:
  - id: kp-tp5-1
    text: newFixedThreadPool/newSingleThreadExecutor：无界 LinkedBlockingQueue——任务堆积撑爆内存
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
      locator: java.util.concurrent
  - id: kp-tp5-2
    text: newCachedThreadPool：max 是 Integer.MAX_VALUE——线程数失控
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
      locator: java.util.concurrent
  - id: kp-tp5-3
    text: newScheduledThreadPool：同样无界队列
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNY7V9X1C3E5G7J9M1
      - 01M3NE18CP02B6D8F0H2J4M6Q8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tp5-4
    text: 阿里规范：手动 new ThreadPoolExecutor——显式有界队列 + 明确参数 + 命名工厂
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
      locator: java.util.concurrent
misconceptions:
  - id: mc-tp5-1
    text: "newFixedThreadPool 的风险在于线程数会无限膨胀"
    why: "误解：fixed 的线程数恒定，炸的是那条不设上限的队列——上游一抖任务全堵在内存里"
  - id: mc-tp5-2
    text: "newCachedThreadPool 的风险在于无界队列堆积任务"
    why: "误解：它用零容量的同步移交队列，任务根本不排队；风险是 max 线程数不设顶，洪峰时无限开线程压垮 OS"
  - id: mc-tp5-3
    text: "禁用 Executors 是因为老版本实现有 bug，JDK 17 已修复可以放心用"
    why: "误解：工厂方法从来不是 bug，禁的是无界队列与无界线程数这类默认资源配置；这个风险在 JDK 17 原样存在"
---

Executors 的方便面**三宗罪**：

- `fixed/single`：队列**无界**（Integer.MAX_VALUE）——上游一抖，任务全堵在队列里，**内存被排队排爆**（OOM）；
- `cached`：max 线程数 **Integer.MAX_VALUE**——一波洪峰无限开线程，**OS 被线程压垮**；
- `scheduled`：同样无界。

《阿里手册》禁令的解法：**手动 `new ThreadPoolExecutor(...)`**——有界队列（尺寸即背压水位）、明确的 max 与拒绝策略、**命名 ThreadFactory**。每个参数都是你签字画押的，而不是埋默认雷。

**术语速查**：无界队列=没有上限的排班表｜线程失控=max 无限开｜显式构造=参数自己签字

<!--advanced-->
《Java 并发编程实战》与 Dubbo/Netty 皆自建池工厂。有界队列的容量=削峰缓冲区大小（与超时、下游速率联合估算）。线程数经验：CPU 密集 ≈ N+1；IO 密集 ≈ N·(1+候时/算时)。动态线程池（配置中心调 core/max/queue）是有界化后的弹性补丁。
