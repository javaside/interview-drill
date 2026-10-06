---
id: 01M3NE18CMK2W6BW4F62HZ2P6R
blockId: distributed/dist-cache
relatedBlocks: []
question: Redis 的持久化方式 RDB 和 AOF？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - everysec 会丢多少？
keyPoints:
  - id: kp-dc8-1
    text: RDB：定时快照（fork 子进程全量二进制）——恢复快、丢数据多
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dc8-2
    text: AOF：追加写命令日志——丢得少、文件大恢复慢
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dc8-3
    text: AOF 重写：fork 子进程把日志压缩为最小命令集（bgrewriteaof）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dc8-4
    text: 4.0 混合持久化：RDB 全量 + 增量 AOF——两全
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dc8-5
    text: appendfsync 三档：always/everysec（默认，丢 1 秒）/no
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

两种**持久化**路线（解决 Redis 重启数据丢不丢）：

- **RDB（快照）**：定时 `bgsave`——**fork 子进程**把全量内存写二进制文件。优：文件紧凑**恢复快**；劣：**两次快照间的数据全丢**（默认配置最多丢分钟级）；
- **AOF（日志）**：每条写命令**追加**到文件。`appendfsync` 三档刷盘策略：`always`（每命令刷，最多丢一条，巨慢）/ **`everysec`（每秒刷——默认，最多丢 1 秒）**/ `no`（交给 OS，不可控）。AOF 越写越长 → **AOF 重写**（fork 子进程把当前状态压成最小命令集，期间新写进重写缓冲）；
- **混合持久化**（4.0+）：重写时**头部 RDB 全量 + 尾部增量 AOF**——恢复速度接近 RDB、丢失窗口接近 AOF——两全，推荐。

**术语速查**：fork 快照=子进程拍全照｜追加日志=写一条记一条｜混合=全量头+增量尾

<!--advanced-->
fork 的 COW（copy-on-write）与内存膨胀风险（写时复制页翻倍）。aof 重写的 fork 双写缓冲（aof_rewrite_buf 的增量追补）。7.0 的 Multi-Part AOF（manifest+分片）。
