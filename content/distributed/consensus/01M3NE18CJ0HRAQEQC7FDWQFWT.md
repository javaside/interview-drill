---
id: 01M3NE18CJ0HRAQEQC7FDWQFWT
blockId: distributed/consensus
relatedBlocks:
  []
question: "Raft 的选主流程？"
cardType: sequence
appliesTo: 通用
frequency: high
followUps:
  - 为什么是过半而不是全部？
keyPoints:
  - id: kp-cs1-1
    text: "第 1 步 节点初始为 Follower，超时未闻心跳则变 Candidate 发起选举"
    public: false
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-cs1-2
    text: "第 2 步 自增任期号，投自己一票，向其他节点拉票"
    public: false
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-cs1-3
    text: "第 3 步 收到过半选票则当选 Leader，广播心跳"
    public: false
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-cs1-4
    text: "第 4 步 任期内日志只从 Leader 流向 Follower"
    public: false
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
---

**Raft** 把共识拆成「选主 + 日志复制」两件事。选主四步（按序排）：

①Follower **选举超时**没等到 Leader 心跳 → 自封 **Candidate**、任期 term+1、投自己并向全体拉票；②收到**过半**选票 → 当选 **Leader**，立刻广播心跳压场（别人别再选了）；③此后**一切写入经 Leader**，日志从 Leader 单向流向 Follower；④Leader 挂 → 剩余节点超时，新一轮选举重启。

**过半的理由**：任意两个「过半集合」必有交集——**最多一个 Leader 能在任一任期当选**（防脑裂出双主）。过半还容忍少数派故障：5 台挂 2 台照常工作。

**术语速查**：任期 term=逻辑时钟的届次｜过半=任意两个过半必有交集｜心跳=Leader 存活的宣示

<!--advanced-->
随机化选举超时（150-300ms）避免分票死循环；预投票（pre-vote）防孤立节点扰任期。日志匹配性质：任期+前序索引一致才接受。etcd/consul/nacos 持久实例都用 Raft 变体。
