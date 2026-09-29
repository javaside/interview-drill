---
id: 01M3NE18CNTA1F3H5J7M9Q2T4
blockId: os/io-model
relatedBlocks:
  []
question: "IO 调度器在调度什么？SSD 为什么可以关掉？"
cardType: enumeration
appliesTo: Linux
frequency: mid
followUps:
  - 读为什么通常比写优先？
  - 虚拟机盘的调度器怎么配？
keyPoints:
  - id: kp-di4-1
    text: "目标：合并相邻请求+排序路径，减少机械盘寻道"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
  - id: kp-di4-2
    text: "mq-deadline：保证每个请求有截止时间——防饿死，默认之一"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
  - id: kp-di4-3
    text: "bfq：按进程公平分配带宽——桌面交互体验"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
  - id: kp-di4-4
    text: "none：不排序——SSD/ NVMe 常配（无寻道可省）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
  - id: kp-di4-5
    text: "多队列（blk-mq）：每核一条队列锁竞争少——现代默认架构"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
---

IO 调度器管的是**块设备请求队列的插队艺术**——在「公平」与「总吞吐」间周旋：

- **为什么有用**：上层请求乱序到（随机块号），调度器**合并相邻**（两次读挨着=一次读两块）+**按块号排序**——HDD 磁头少跑冤枉路；顺手做**优先级**：读通常给短截止期（用户在候读结果，写可以后台攒）；
- **mq-deadline**：每请求带期限，到期强制发——**防饿死**（一直有读，写也别想永远候着）；服务器默认；
- **bfq**：按 cgroup/进程**切带宽**——「备份拷贝不影响打字」的桌面体验；
- **none**：什么都不做。**SSD 没有 10ms 寻道**——排序收益归零、只剩延迟与 CPU 开销——**NVMe 常配 none**（请求来了直接下发给并行通道）；
- **blk-mq 多队列架构**：旧时代单队列一把锁（多核打架），现在**每核软件队列+硬件多队列**——调度器都长在多队列上（现代内核的默认底座）。

**虚拟机的坑**：Guest 里排序完，到宿主机虚拟盘又被搅乱——**Guest 配 none，让宿主统一调度**。

**术语速查**：合并+排序=调度器的两手|截止期=反饿死的保险|SSD 配 none=没寻道就没排序

<!--advanced-->
ionice 与 cgroup blkio 权重。kyber（按延迟目标调度的现代设计）。io_uring 的 SQPQ 与用户态排队（队列思想再上移一层）。
