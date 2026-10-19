---
id: 01M3NE18CK1PSW0XJR26K8F82K
blockId: distributed/consensus
relatedBlocks: []
question: Paxos 和 Raft 的区别？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - Raft 为什么能取代 Paxos？
keyPoints:
  - id: kp-cs2-1
    text: Paxos：理论优美但难懂难实现——只解决单值共识
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-cs2-2
    text: Raft：为可理解性设计——强 Leader 分解出选主与日志复制
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-cs2-3
    text: Multi-Paxos 可达到 Raft 效果但工程细节需自行补全
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-cs2-4
    text: 工业界几乎全用 Raft（etcd/Consul/Kafka KRaft）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
misconceptions:
  - id: mc-cs2-1
    text: "工业界选 Raft 弃 Paxos，是因为 Raft 的吞吐性能高出一截"
    why: "误解：Raft 赢在可理解、可实现、正确性易验证——Multi-Paxos 补全细节后性能不落下风，输的是工程把握不是跑分"
  - id: mc-cs2-2
    text: "Paxos 只能对单个值达成共识，所以工程界其实没人用它"
    why: "误解：单值只是理论内核——Chubby 与 Spanner 都长在 Paxos 血统上，把 instance 复用加 leader 优化就是工程里的 Multi-Paxos"
  - id: mc-cs2-3
    text: "Raft 能容忍节点作恶，日志被恶意篡改也会被识别拒绝"
    why: "误解：Raft 只做崩溃容错，假设节点不撒谎——防恶意节点是拜占庭容错的地盘，要 PBFT 这类协议，那是区块链的场景"
---

**Paxos** 是共识的理论基石（Lamport 1989）——正确但**出了名的难懂难实现**：只定义单值共识，工程化作多日志需要自行补全大量细节（每个实现都不一样）。**Raft**（2013）的目标明确写论文名里：*In Search of an Understandable Consensus Algorithm*——**用可理解性换实现一致性**：

- **强 Leader**：一切经 Leader（Paxos 任何节点可提案）——把问题拆成**选主 + 日志复制**两个子问题，各自简单；
- 日志**连续、双向确认**（Leader 自己不补空洞，保证日志可重放）；
- 结果：工业界事实标准——**etcd / Consul / TiKV / Kafka KRaft / Nacos CP 模式**全是 Raft。

**术语速查**：强 Leader=一切写入单点发起｜可理解性=Raft 的第一设计目标｜事实标准=工程界用脚投票

<!--advanced-->
Paxos 的两阶段（prepare/promise, accept/accepted）与 instance 复制成 Multi-Paxos 的 leader 优化。Raft 的 membership change（joint consensus/single-server）。拜占庭容错（BFT/PBFT）与非拜占庭的分界——区块链才需要前者。
