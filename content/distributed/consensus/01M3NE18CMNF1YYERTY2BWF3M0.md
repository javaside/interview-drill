---
id: 01M3NE18CMNF1YYERTY2BWF3M0
blockId: distributed/consensus
relatedBlocks: []
question: 拜占庭错误和一般故障的区别？
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - 为什么数据库集群不用 BFT？
keyPoints:
  - id: kp-cs5-1
    text: 一般故障：节点宕机/失联——不撒谎，只是不响应
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-cs5-2
    text: 拜占庭故障：节点作恶——发假消息/双面话
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-cs5-3
    text: 内网可信环境（公司机房）只需容忍一般故障——Raft 够用
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-cs5-4
    text: 开放环境（区块链/多方协作）才需要 BFT——3f+1 容 f 个恶节点
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-cs5-5
    text: PBFT/POW 是拜占庭容错的代表
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

故障模型决定算法选型：

- **崩溃故障（crash）**：节点只会**挂/失联**，不说谎——机房的常态（断电/网络/内核崩）。容忍它的算法便宜：**2f+1 台容 f 台**（Raft/Paxos）；
- **拜占庭故障（byzantine）**：节点会**作恶**——发假数据、对不同人说不同话。来源：被黑、恶意节点、坏内存静默翻转数据。容忍它要贵得多：**3f+1 台容 f 台**（PBFT），且消息复杂度平方级。

**内网集群不用 BFT 的理由**：机房节点在**同一信任域**（运维管控），「作恶」概率远低于「宕机」——用 BFT 是花 3 倍机器防一个不存在的问题。**区块链**正相反：任何人都可当节点（无信任域）——必须假设有人作恶，POW/PoS 经济激励+BFT 混合。

**术语速查**：不响应但不说谎=崩溃故障｜双面话=拜占庭｜2f+1 vs 3f+1=两种故障的机器价格

<!--advanced-->
POW 的「计算成本换诚实」与 PBFT 的三阶段消息复杂度。飞机三余度系统的历史类比。跨公司联盟链（信任有限）是 BFT 的中间场景。
