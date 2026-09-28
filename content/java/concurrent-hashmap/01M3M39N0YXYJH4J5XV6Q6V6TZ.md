---
id: 01M3M39N0YXYJH4J5XV6Q6V6TZ
blockId: java/concurrent-hashmap
relatedBlocks:
  []
question: "JDK 8 的 ConcurrentHashMap 是怎么保证线程安全的？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么不再用分段锁？
keyPoints:
  - id: kp-ch1-1
    text: "无锁读：get 不加锁（Node.val/hash 用 volatile 保证可见性）"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-ch1-2
    text: "put：CAS 初始化桶/空桶插入，非空桶 synchronized 锁桶头节点"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-ch1-3
    text: "锁粒度=单桶：不同桶的写完全并行"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-ch1-4
    text: "size 用 CounterCell 分散计数（无全局锁热点）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-ch1-5
    text: "key 的 hash 与 val 均 volatile，读线程立即可见最新值"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

1.8 的方案——**读无锁 + 写锁单桶**：

- **get**：全程**不加锁**——数组和节点字段都 volatile，读到的永远是最新值；
- **put**：桶是空的 → **CAS** 直接塞进去；桶有人 → **synchronized 锁住桶的头节点**再操作——锁的粒度就是**一个桶**，不同桶的写互不干扰；
- **size**：不维护精确计数，用 **CounterCell 数组分散累加**（各线程写不同格子，求和时再汇总）——避免一个共享计数器成为所有线程的争用点。

对比 1.7 的分段锁（Segment 整段加锁）：8 的粒度更细（桶级），且用 JDK 内建的 synchronized（锁升级优化）替代自定义 ReentrantLock。

**术语速查**：CAS=比较并交换（无锁写入）｜volatile=写立即对读者可见｜锁桶头=只锁一条链的入口

<!--advanced-->
tabAt 用 Unsafe.getObjectAcquire 读 volatile 语义；初始化用 sizeCtl 的 CAS 争用。get 的 Node.hash moved<0 转发到 ForwardingNode（resize 协助遍历）。hash 恒 -1(MOVED)/-2(TREEBIN) 作状态哨兵。counterCells 即 LongAdder 思想。
