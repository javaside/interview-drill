---
id: 01M3M39N0Y9Y1HVSZ7WECWVP9R
blockId: java/arraylist
relatedBlocks:
  []
question: "ArrayList 是线程安全的吗？有哪些替代？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - CopyOnWriteArrayList 的写代价是什么？
keyPoints:
  - id: kp-al5-1
    text: "不是：并发 add 可丢数据，扩容竞态可抛 ArrayIndexOutOfBounds"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-al5-2
    text: "Collections.synchronizedList：全方法 synchronized 的包装（粗但简单）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-al5-3
    text: "CopyOnWriteArrayList：写时复制新数组，读完全无锁——读多写少首选"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-al5-4
    text: "并发迭代：COW 天然快照安全；synchronized 需 synchronized 块包裹"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

**不安全**。并发场景两类替代：

- **`Collections.synchronizedList(list)`**：把每个方法都套上 synchronized——简单粗暴，读写全排队，迭代时还得手动加锁（否则照样 CME）。
- **`CopyOnWriteArrayList`**：**每次写都复制一份新数组**，改完原子换引用——**读永远无锁**（读的是旧快照，天然安全）。适合**读极多写极少**的监听器列表、配置表。

写代价：每次 add/remove 都全量拷贝数组——写频繁就灾难。选型一句话：**读多写少 COW，写多就老老实实加锁或换并发队列**。

**术语速查**：写时复制=改前先拷一份｜快照读=读到的是当时的稳定版本｜CME=并发修改异常

<!--advanced-->
COW 的迭代器持有创建时数组引用（final snapshot），iter.remove 不支持（抛 UOE）。synchronizedList 的复合操作（if(!contains)add）仍需外部同步——方法级锁不构成原子性组合。Vector 是历史遗留，等价 synchronizedList 语义。
