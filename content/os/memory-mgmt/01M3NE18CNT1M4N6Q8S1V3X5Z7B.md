---
id: 01M3NE18CNT1M4N6Q8S1V3X5Z7B
blockId: os/memory-mgmt
relatedBlocks:
  []
question: "mmap 和共享内存是怎么回事？"
cardType: enumeration
appliesTo: Linux
frequency: mid
followUps:
  - mmap 读文件比 read 快在哪？
  - 什么时候不该用 mmap？
keyPoints:
  - id: kp-mm5-1
    text: "mmap：把文件/匿名内存映射进地址空间——访问内存即读写文件"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: 'mmap(2)'
  - id: kp-mm5-2
    text: "匿名映射：纯内存（malloc 大块/加载器建堆）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: 'mmap(2)'
  - id: kp-mm5-3
    text: "文件映射：页缓存即视图——读文件零拷贝进用户态"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: 'mmap(2)'
  - id: kp-mm5-4
    text: "MAP_SHARED：两进程映射同一文件/同 shm——写完即互通"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: 'mmap(2)'
  - id: kp-mm5-5
    text: "工程应用：程序加载/Redis 快照写盘/MQ 消息文件/DB 数据文件"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: 'mmap(2)'
---

**mmap** = 「把文件当数组访问」：

```
fd = open("data.bin");  p = mmap(fd);
p[100] = 'x';   // 直接按下标读写——背后是缺页内核把文件页映射进来
```

**两条路线**：**匿名映射**（MAP_ANONYMOUS——不要文件，纯要一块内存：malloc 大块、程序启动建堆都用它）；**文件映射**（MAP_PRIVATE 私有改动不回写 / **MAP_SHARED 改动落盘且互通**）。

**文件 mmap 的快**：read 要「内核页缓存→用户缓冲」一次拷贝；mmap 后**页缓存直接出现在你的地址空间**——省拷贝；且缺页按需加载（只摸前 1KB 就只读一页）。**共享内存（shm/POSIX）**就是「双方 MAP_SHARED 映射同一块」——写完即互通（IPC 最快的原理）。

**不该用 mmap 的场景**：①**随机小写**（每次缺页代价+脏页回写不可控）；②**文件被外部截断**（SIGBUS 崩溃风险）；③**极小文件**（映射的建立开销不划算）。**顺序大块读+追求零拷贝**才是它的主场（RocketMQ 消费文件、Redis RDB 写出、可执行程序加载）。

**术语速查**：文件当数组=mmap 的体感|页缓存即视图=零拷贝的来源|互通=MAP_SHARED 的意义

<!--advanced-->
mmap+write vs sendfile 的分工（要改数据用前者，纯转发用后者）。MAP_POPULATE 预热与 THP 对齐。mincore/madvise（WILLNEED/DONTNEED）精细控制。
