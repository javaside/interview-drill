---
id: 01M3M59WSF2ZWAAB0BBFR4YXFV
blockId: concurrency/threadlocal
relatedBlocks:
  []
question: "ThreadLocal 的原理是什么？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么把 map 放在线程里而不是 ThreadLocal 里？
keyPoints:
  - id: kp-tl1-1
    text: "每个 Thread 内置一个 ThreadLocalMap：键是 ThreadLocal 弱引用，值是变量副本"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tl1-2
    text: "set/get 都先摸到当前线程自己的 map——天然按线程隔离"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tl1-3
    text: "哈希冲突用开放地址（线性探测）而非链表"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'

  - id: kp-tl1-4
    text: "同一个 ThreadLocal 在不同线程中各存各的互不可见"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: 'java.util.concurrent'
---

**ThreadLocal = 线程私有的储物柜**。实现反直觉但妙：

- 每个 **Thread 对象**里塞着一个 `ThreadLocalMap`；
- 这个 map 的**键是 ThreadLocal 实例本身**（弱引用），**值是你塞的变量**；
- `tl.set(v)` 实际是 `当前线程.threadLocalMap.put(this, v)`——各存各的柜子，天然隔离、无竞争。

为什么 map 长在线程身上而不是 ThreadLocal 身上？若 ThreadLocal 持 map<Thread, 值>：**线程对象被强引用着永远回收不掉**（且要加锁防并发写）。倒过来放——线程死了柜子跟着走，弱引用键又让 ThreadLocal 先死时条目能被清。

**术语速查**：ThreadLocalMap=线程自带的柜子｜弱引用键=ThreadLocal 的钥匙会先化｜开放地址=冲突了往后挪一格

<!--advanced-->
Entry extends WeakReference<ThreadLocal<?>>；探测式清除（set/get 顺路扫 stale）+ expungeStaleConnection；threadLocalHashCode 的 0x61c88647 黄金分割增量（散列均匀）。InheritableThreadLocal 走另一张 inheritableThreadLocals（创建子线程时拷贝）。
