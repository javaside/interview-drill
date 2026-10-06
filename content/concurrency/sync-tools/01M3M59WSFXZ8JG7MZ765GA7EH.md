---
id: 01M3M59WSFXZ8JG7MZ765GA7EH
blockId: concurrency/sync-tools
relatedBlocks: []
question: Exchanger 是什么？
cardType: atomic
appliesTo: Java 17+
frequency: low
followUps:
  - 遗传算法里怎么用它？
keyPoints:
  - id: kp-st3-1
    text: 两线程的汇合点：各自 exchange 自家的货，在栅栏处互换拿到对方的货
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: juc
---

**双人交换台**：两个线程各自带着「自己的货」到 exchange() 碰头——**先到的候着**，后到的一到，两人**互换货物**各自继续。

经典舞台：**遗传算法**（一代种群分两半、两线程各变异一半后在汇合点交换结果）；**双向管道**（生产者给数据、消费者回填缓冲，buffer 互换）。

**术语速查**：汇合=先到先候、成双互换｜双人限定=就两个线程的游戏

<!--advanced-->
基于 arena/slot 的 CAS（Node 交换槽），支持超时与中断变体。与 SynchronousQueue 的类比：SQC 单向递货、Exchanger 双向互换。
