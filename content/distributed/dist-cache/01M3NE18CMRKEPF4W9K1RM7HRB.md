---
id: 01M3NE18CMRKEPF4W9K1RM7HRB
blockId: distributed/dist-cache
relatedBlocks: []
question: Redis 主从复制和哨兵的作用？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 哨兵为什么至少 3 个？
keyPoints:
  - id: kp-dc9-1
    text: 主从：全量 RDB 同步 + 增量命令流复制——读写分离扩读
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dc9-2
    text: 哨兵 Sentinel：监控主——宕了自动挑从升主（故障转移）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dc9-3
    text: 哨兵需过半同意才判定主死（防误判脑裂）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dc9-4
    text: 客户端订阅哨兵感知新主地址
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dc9-5
    text: 异步复制的丢失窗口：主写完没来得及同步就挂——新主可能缺最新写
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

**高可用的两层积木**：

1. **主从复制**：从库连主——先**全量**（主 bgsave 传 RDB）再**增量**（命令流持续同步）。价值：读扩展 + 数据副本；
2. **哨兵（Sentinel）**：独立的「监工」进程集群（**至少 3 个**）——持续 ping 主；**过半哨兵**认为主死了 → 判定客观下线 → 哨兵之间**选出一个哨兵执行故障转移**：挑最优从库升主、其余从库改挂新主、**通知客户端新地址**。

**为什么至少 3 个**：判定要**过半**——1 个哨兵自己单点；2 个挂 1 个就不够半（1/2 不算过半）；**3 个容忍 1 个**（2/3 过半）。奇数递增同理（5 容 2）。

**丢数据窗口**：复制是**异步**——主写完（已应答客户端）还没传到从就宕 → 升主后这批写**丢**。要求不丢：`min-replicas-to-write`（写需至少 N 个从在线）——牺牲可用性换一致。

**术语速查**：全量+增量=先拍照后直播｜客观下线=过半判死｜异步窗口=主从间的时间差

<!--advanced-->
repl_backlog 环形缓冲与 psync 部分重同步。选从的优先级（offset 最新/runid）。cluster 模式（分片+自治故障转移，16384 槽）与哨兵模式的边界（容量 vs 高可用）。
