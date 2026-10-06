---
id: 01M3NE18CNS9H1J3M5N7R9T2W4Y
blockId: os/memory-mgmt
relatedBlocks: []
question: malloc 的底层怎么工作？
cardType: enumeration
appliesTo: Linux
frequency: mid
followUps:
  - 为什么 free 了 RSS 不降？
  - 内存池为什么比裸 malloc 快？
keyPoints:
  - id: kp-mm3-1
    text: 小内存走 brk 扩堆，大内存走 mmap 直映
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: malloc(3)
  - id: kp-mm3-2
    text: glibc malloc 加arena 内存池：空闲链/桶分级，减少系统调用
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: malloc(3)
  - id: kp-mm3-3
    text: free 不还内核：池里复用——RSS 居高不下常是碎片
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: malloc(3)
  - id: kp-mm3-4
    text: 多线程各自的 arena 减少锁竞争（64 位默认最多 8×核数）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: malloc(3)
  - id: kp-mm3-5
    text: brk 顶部有洞就不能收缩——碎片让 RSS 只涨不降
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: malloc(3)
---

`malloc` 是 **glibc 的用户态库**，不是系统调用——它替你管「**问内核要大块，切成小块批发**」：

- **brk 路线**（小块，<128KB）：把堆顶指针上推——堆连续扩张；free 后**先留着复用**（不还内核）；
- **mmap 路线**（大块，≥128KB）：独立映射一块，free 时 **munmap 直接还给内核**（RSS 立降——大批量分配能看到）；
- **ptmalloc 的池**：拿到的块按大小分级（fastbin/smallbin/largebin 空闲链表）——malloc/free 常态下是**纯用户态链表操作**（零系统调用，纳秒级）；
- **多线程 arena**：每线程尽量用自己的 arena（堆区），免得全局锁打架。

**「free 了 RSS 不降」的三个解释**：①free 只是**还给池**（下次复用，内核不知情）；②brk 收缩只在**堆顶**连续空闲时发生——中间有洞就退不了；③**碎片化**——空闲总量够但拼不出连续大块（长期运行的服务的通病；jemalloc/tcmalloc 按页管理+分桶，抗碎片更好）。

**为什么应用还要自建内存池**：malloc 快（纳秒）但仍有开销（链表+锁），**定长对象的场景**（DB 连接/消息节点）一次批发一块自己管——零碎片零锁零系统调用。

**术语速查**：批发+零售=malloc 的商业模式|arena=线程各自的柜台|洞=碎片堵住退路

<!--advanced-->
jemalloc/tcmalloc 的设计差（size class 与 thread cache）。malloc_trim 与 MALLOC_ARENA_MAX 的实战（容器里 Java Native 内存 RSS 治理）。slab allocator（内核的同款思想——对象复用）。
