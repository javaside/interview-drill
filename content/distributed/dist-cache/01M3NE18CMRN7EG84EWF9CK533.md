---
id: 01M3NE18CMRN7EG84EWF9CK533
blockId: distributed/dist-cache
relatedBlocks: []
question: Redis 集群模式的数据分布？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 为什么是 16384 个槽？
keyPoints:
  - id: kp-dca-1
    text: 16384 个哈希槽：key 的 CRC16 取模落槽，槽分配到节点
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNQFGY7ZQBDA3P1QXB
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dca-2
    text: hash tag {user1000}.x 强制同 key 同槽（多键操作的前提）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CM78ZDR6APCEKB733T
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dca-3
    text: MOVED 重定向：请求到错节点时告知正确节点
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dca-4
    text: ASK/智能客户端：客户端缓存槽位表直连目标
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dca-5
    text: 扩缩容：槽迁移（逐 key 搬）期间 ASK 引导到迁移中节点
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
misconceptions:
  - id: mc-dca-1
    text: "Redis Cluster 用一致性哈希环分配 key，增删节点只影响环上相邻节点的数据"
    why: "误解：Cluster 是 CRC16 对 16384 取模落槽、槽再划给节点，增删节点靠槽迁移搬数据；哈希环是客户端分片时代的另一套方案"
  - id: mc-dca-2
    text: "ASK 与 MOVED 含义相同，客户端收到任意一个都应永久更新本地槽位表再重试"
    why: "误解：MOVED 才表示映射过时要改表；ASK 只针对迁移中的槽，本次带 ASKING 去新节点重试即可，表不能动"
---

**Redis Cluster** 的分片方案——**16384 个哈希槽**：

```
key → CRC16(key) % 16384 → 槽 → 节点（每节点负责一段槽）
```

- **hash tag**：`{user1000}.orders` 与 `{user1000}.profile`——**大括号内的串决定槽**——同一用户的 key 落同节点（multi/getsl 等多键操作要求同槽）；
- **客户端直连**：智能客户端缓存「槽→节点」映射直连（普通客户端发错节点会收 **MOVED** 重定向再取正确节点）；
- **在线扩缩容**：槽在节点间**迁移**（逐 key MOVE）——迁移中的槽 ASK 引导到新节点，**不停止服务**。

**为什么 16384**：槽的元信息要在节点间 gossip 传播（心跳包带自己负责的槽位图）——**16384bit=2KB** 恰好经济；槽越多位图越大心跳越重，槽太少（如 1024）又限制集群规模（百节点级）——16384 是折中。

**术语速查**：槽=分片的格子｜hash tag=强制同格的魔法括号｜MOVED=指路的应答

<!--advanced-->
gossip 的 PING/PONG 槽位图与 cluster bus 端口。故障检测（PFAIL 主观→FAIL 客观过半）与从库发起选举继槽。客户端侧的连接池按节点分组。
