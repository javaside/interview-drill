---
id: 01M3NE18CNT9D1F3H5J7M9Q2T
blockId: os/io-model
relatedBlocks:
  []
question: "iostat 的指标怎么读？%util 高就是瓶颈吗？"
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - iowait 高就一定是磁盘慢吗？
  - 怎么区分是设备慢还是请求太多？
keyPoints:
  - id: kp-di3-1
    text: "核心四指标：r/s ws（频率）、await（每次 IO 候+服务的毫秒）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
  - id: kp-di3-2
    text: "avgqu-sz 队列深度：排队越长积压越重"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
  - id: kp-di3-3
    text: "%util 设备忙的百分比——SSD 并行下 100% 并非即饱和"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
  - id: kp-di3-4
    text: "看 await 是否恶化比看 util 更可靠：await 数倍于常态即病"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
  - id: kp-di3-5
    text: "配合 iotop 找到发起 IO 的进程，dstat 看读写构成"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: 'block'
---

`iostat -x 1` 一屏指标，按重要性读：

| 指标 | 含义 | 怎么读 |
|---|---|---|
| **r/s w/s** | 每秒读/写次数 | 与 IOPS 上限对照 |
| **await** | 每个 IO 的**候队列+服务**总耗时（ms） | **最有含金量**——对照常态（SSD 亚毫秒、HDD 几毫秒），**飙到几十 ms=体验劣化** |
| **avgqu-sz** | 平均队列深度 | 排队的人多=供不应求 |
| %util | 设备有请求在跑的时间占比 | HDD 上近饱和信号；**SSD 可并行，100% 时吞吐可能还有余量** |

**%util 的坑**：SSD 内部几十个通道并行，一次只发一个请求也能把它「占满」（100%）——**吞吐、await 才是硬指标**，util 只对 HDD 接近真饱和。

**定位套路**：`iostat -x 1` 看到 await 恶化 → `iotop -o`（只看正在做 IO 的进程）找到元凶 → 分析它是谁（DB 刷脏页？日志狂写？备份扫描？）。**%iowait 高**只是「CPU 有时间在候 IO」的旁证——先看 await 确认设备真慢，还是**请求量太大**（加缓存/削峰）抑或**设备不行**（升 NVMe）。

**术语速查**：await=候+服务的总账|队列深=积压|SSD 的 100%=虚胖

<!--advanced-->
blktrace/btt（IO 全链路分解——Q/G/D/C 各段耗时）。fio 的 iodepth 与 size 摸设备底（4k 随机 vs 1M 顺序两套上限）。cgroup v2 io.max 限容器 IO（防邻居吵）。
