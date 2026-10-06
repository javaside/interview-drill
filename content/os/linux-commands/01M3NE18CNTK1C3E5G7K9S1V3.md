---
id: 01M3NE18CNTK1C3E5G7K9S1V3
blockId: os/linux-commands
relatedBlocks: []
question: 磁盘满了/磁盘忙，怎么查？
cardType: enumeration
appliesTo: Linux
frequency: mid
followUps:
  - df -i 是什么？
  - 为什么 df 显示满但 du 找不到大文件？
keyPoints:
  - id: kp-lc3-1
    text: df -h 看 inode 与容量两条线：满可能不是容量是 inode 耗尽
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: df(1)
  - id: kp-lc3-2
    text: du -x 逐层对比定位大目录；df/du 差值=被删未释放的幽灵文件
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: df(1)
  - id: kp-lc3-3
    text: iostat -x 看 await/util；iotop -o 找到正在 IO 的进程
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: df(1)
  - id: kp-lc3-4
    text: inode 耗尽的经典：海量小文件（邮件队列/临时文件）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: df(1)
  - id: kp-lc3-5
    text: 治后必防：日志轮转+配额+告警（用量阈值）三件套
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: df(1)
---

磁盘「满」有两种满，先分清再下药：

- **容量满**（`df -h` 的 Use% 到 100%）：`du -x --max-depth=1 /` 逐层下钻找大目录（**-x 不跨文件系统**，防止钻进挂载的别的盘）。**df 与 du 对不上**=幽灵文件（已删但被进程握着——`lsof | grep deleted`，见文件系统块那张卡）；
- **inode 满**（`df -i`）：容量还有剩但**文件数到顶**——创建报 `No space left on device` 却 df -h 看着没事。元凶：**海量小文件**（邮件队列堆积、session 文件、docker 镜像层碎片）。找法：`for i in /*; do echo $i $(find $i -xdev | wc -l); done` 数各目录文件数。

**磁盘忙**（业务慢但 CPU 闲）：`iostat -x 1` 看 **await**（每次 IO 延迟）与 %util → `iotop -o`（只显示正在 IO 的进程）锁定元凶 → 分析类型（DB 刷脏页/日志写入/备份扫描/cron 风暴）。

**治后必防**：日志轮转（logrotate+压缩+保留 N 份）、分区配额或容器盘 limit、**用量告警**（80% 黄线 90% 红线——等满了再救都是被动挨打）。

**术语速查**：两种满=容量与文件数|幽灵文件=df/du 的差|iotop -o=只看现行犯

<!--advanced-->
 ncdu 的交互式下钻（比 du 省心）。journalctl 的磁盘占用上限（SystemMaxUse）。容器 overlay 层堆积（docker system prune 的边界——别 rm -rf /var/lib/docker 了事）。
