---
id: 01M3NE18CNTB3H5J7M9Q2T4V6
blockId: os/io-model
relatedBlocks: []
question: HDD 和 SSD 的性能特性差在哪？
cardType: enumeration
appliesTo: Linux
frequency: mid
followUps:
  - 为什么 SSD 写多了会掉速？
  - 4K 对齐影响什么？
keyPoints:
  - id: kp-di5-1
    text: HDD：寻道+旋转毫秒级——顺序尚可、随机极慢
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: block
  - id: kp-di5-2
    text: SSD：电子寻址微秒级——随机读轻松数十万 IOPS
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: block
  - id: kp-di5-3
    text: SSD 写约束：擦除块大、先擦后写——引出写放大与 GC
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: block
  - id: kp-di5-4
    text: SSD 寿命：P/E 次数有限——磨损均衡与预留空间兜底
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: block
  - id: kp-di5-5
    text: 对应用的意义：小 IO 延迟、对齐、避免频繁原地改写
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/block/index.html
      locator: block
---

两种介质的物理决定命运：

| 维度 | HDD 机械盘 | SSD 固态 |
|---|---|---|
| 定位数据 | **磁头寻道+盘片旋转**（~10ms） | 电子寻址（**~100μs**） |
| 随机 IOPS | ~100 | **数十万**（NVMe） |
| 写机制 | 直接磁记录，原地覆盖 | **按页写、按块擦**（擦除块≈几 MB）——**先搬走整块有效数据再擦** |
| 寿命 | 无限写 | **P/E 次数有限**（TLC ~3000 次） |

**SSD 的两个衍生病**：①**写放大**（WAF）——改 4KB 可能引发搬几 MB（GC 把有效页挪走才能擦块）；预留空间（OP）越大、写入越顺序，WAF 越低；②**掉速**——空闲块耗尽后每次写都要现场 GC（**脏盘写满后掉速**的根源；TRIM 归还无效块让 SSD 提前回收）。

**对应用的三条纪律**：分区**4K 对齐**（跨擦除边界=一次写变两次）；**避免高频原地小改**（LSM/追加写友好）；监控**磨损指标**（smartctl 的 percentage_used）而非只看容量。

**术语速查**：先擦后写=SSD 的枷锁|OP 预留=给 GC 的喘息地|TRIM=通知盘哪些块作废

<!--advanced-->
FTL 映射表（逻辑页→物理页——断电丢映射的电容保护）。SLC cache（伪 SLC 缓冲——爆发快、写满回落）。ZNS 与 FDP（让软件直面擦除单元的新接口）。
