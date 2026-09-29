---
id: 01M3NE18CNT7Z7B9D1F3H5J7M9Q
blockId: os/io-model
relatedBlocks:
  []
question: "缓冲 IO 和直接 IO（O_DIRECT）怎么选？"
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - 页缓存会不会白占内存？
  - 直接 IO 为什么要求对齐？
keyPoints:
  - id: kp-di1-1
    text: "缓冲 IO：write 只进页缓存即返回——快但有掉电丢失窗口"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
  - id: kp-di1-2
    text: "页缓存红利：重复读命中免盘；预读放大顺序读"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
  - id: kp-di1-3
    text: "直接 IO：绕开页缓存直达磁盘——无重复拷贝但自己管缓存"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
  - id: kp-di1-4
    text: "数据库选直接 IO 的理据：自己有 buffer pool，页缓存纯浪费"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
  - id: kp-di1-5
    text: "普通应用默认缓冲 IO——靠 fsync 控制持久化时点"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
---

**默认的 write 是「写到内存就算完」**——页缓存（PageCache）是内核替所有进程做的**读写缓存**：

- **读**：第一次从盘读入缓存，**再次读同一块=纯内存**（免盘）；顺序读还有**预读**（提前多读几块赌你会来）；
- **写**：进缓存标脏、立即返回；内核**攒一批异步刷盘**（writeback）——吞吐起飞，代价是**掉电窗口**（fsync 收口）。

**O_DIRECT 绕过这一切**：用户缓冲直达磁盘（DMA 要求**地址与长度对齐**——通常 512B/4KB，不对齐直接 EINVAL）。**谁用它**：数据库——InnO/PG **自带 buffer pool**，数据在自家缓存里已经是热的，再过页缓存=**同一份数据缓两遍**（内存浪费+多一次拷贝+回收抖动）；它们要的「缓存+刷盘时机」全自己管。

**选型一句话**：**普通应用**（日志/配置/小文件）——缓冲 IO+fsync，白捡页缓存；**自带缓存引擎的**（DB/MQ）——O_DIRECT+自管，不吃嗟来之食。

**术语速查**：脏页=欠盘的账|预读=赌你会来的提前量|双缓存=数据库绕页缓存的理由

<!--advanced-->
POSIX_FADV_DONTNEED（用完就丢——流式读大文件不污染页缓存）。Direct IO 与异步 IO 的配合（io_uring 直连）。fio 的 direct=1 压测才见真吞吐。
