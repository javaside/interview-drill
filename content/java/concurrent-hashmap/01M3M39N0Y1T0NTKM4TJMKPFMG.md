---
id: 01M3M39N0Y1T0NTKM4TJMKPFMG
blockId: java/concurrent-hashmap
relatedBlocks:
  []
question: "Collections.synchronizedMap 和 ConcurrentHashMap 怎么选？"
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - synchronizedMap 什么时候还有价值？
keyPoints:
  - id: kp-ch5-1
    text: "synchronizedMap：一把锁锁全表，读写下串行——实现简单性能差"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-ch5-2
    text: "ConcurrentHashMap：读无锁、写锁桶，高并发吞吐数量级领先"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-ch5-3
    text: "迭代语义：synchronizedMap 需外部锁且强一致；CHM 迭代弱一致（不抛 CME）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-ch5-4
    text: "选型默认 CHM；只有需要「全表锁定的一致快照」才考虑 synchronized 系"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

- **`Collections.synchronizedMap`**：给普通 Map 全方法套同一把锁——**任何读写都全局排队**。并发一高吞吐崩塌；迭代还得手动持锁。
- **`ConcurrentHashMap`**：读无锁、写只锁一个桶——高并发下吞吐差出**数量级**；迭代是**弱一致**（遍历中反映「进行到哪」的视图，不炸 CME）。

默认答案 CHM。synchronizedMap 的残存价值：需要**整表一致的瞬时快照**（迭代期间不许任何人动）时，一把大锁反而语义直接。

**术语速查**：全局锁=一把锁守全表｜弱一致迭代=不抛异常、反映大致当下｜吞吐=单位时间操作数

<!--advanced-->
CHM 迭代器 weakly consistent：保证遍历到创建时刻已存在且此后未被删的元素，可能或不反映并发插入。batch 基操作（forEach/search/reduce）并行化框架（ForkJoin common pool）。不可变快照替代：new HashMap<>(chm) 弱一致拷贝。
