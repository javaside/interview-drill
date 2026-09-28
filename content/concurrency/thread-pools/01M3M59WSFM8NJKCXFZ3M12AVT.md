---
id: 01M3M59WSFM8NJKCXFZ3M12AVT
blockId: concurrency/thread-pools
relatedBlocks:
  []
question: "为什么不推荐 Executors 的快捷工厂？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - OOM 是怎么发生的？
keyPoints:
  - id: kp-tp5-1
    text: "newFixedThreadPool/newSingleThreadExecutor：无界 LinkedBlockingQueue——任务堆积撑爆内存"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tp5-2
    text: "newCachedThreadPool：max 是 Integer.MAX_VALUE——线程数失控"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tp5-3
    text: "newScheduledThreadPool：同样无界队列"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tp5-4
    text: "阿里规范：手动 new ThreadPoolExecutor——显式有界队列 + 明确参数 + 命名工厂"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'
---

Executors 的方便面**三宗罪**：

- `fixed/single`：队列**无界**（Integer.MAX_VALUE）——上游一抖，任务全堵在队列里，**内存被排队排爆**（OOM）；
- `cached`：max 线程数 **Integer.MAX_VALUE**——一波洪峰无限开线程，**OS 被线程压垮**；
- `scheduled`：同样无界。

《阿里手册》禁令的解法：**手动 `new ThreadPoolExecutor(...)`**——有界队列（尺寸即背压水位）、明确的 max 与拒绝策略、**命名 ThreadFactory**。每个参数都是你签字画押的，而不是埋默认雷。

**术语速查**：无界队列=没有上限的排班表｜线程失控=max 无限开｜显式构造=参数自己签字

<!--advanced-->
《Java 并发编程实战》与 Dubbo/Netty 皆自建池工厂。有界队列的容量=削峰缓冲区大小（与超时、下游速率联合估算）。线程数经验：CPU 密集 ≈ N+1；IO 密集 ≈ N·(1+候时/算时)。动态线程池（配置中心调 core/max/queue）是有界化后的弹性补丁。
