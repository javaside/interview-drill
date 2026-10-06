---
id: 01M3NE18CM3CHEN1XTJGSJGP1S
blockId: distributed/consensus
relatedBlocks: []
question: 什么是脑裂？怎么防？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 过半机制怎么防的？
keyPoints:
  - id: kp-cs4-1
    text: 分区时两段各自选主——双 Leader 同时接受写
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-cs4-2
    text: 防核心：过半票决——少数派永远选不出主
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-cs4-3
    text: 辅助：quorum 读写（双主写互不达过半，超时自动失效）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-cs4-4
    text: 仲裁/fencing token：共享资源拒绝旧主的指令
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

**脑裂**=网络分区把集群劈成两半，各自以为对方死了，**各选一个 Leader，双主并行写**——数据从根上撕裂。

**防御的第一性原理：过半**——任何决策需 **> N/2** 节点同意。3 节点分区成 1+2：**2 那边能选主，1 那边永远凑不够过半**（顶多干着急不服务）——**分区的一侧必然失活，双主不可能出现**。这就是 ZooKeeper/etcd 用奇数节点部署的原因（3/5/7——偶数不增加容错只浪费机器）。

次级防线：**fencing token**（锁/主每次晋升拿递增令牌，存储端拒绝旧令牌——防旧主「复活」后继续写）。

**术语速查**：双主=脑裂的症状｜过半=一侧必然失活｜fencing=旧主令牌作废

<!--advanced-->
st lease 的隐患（时钟漂移租约重叠双主——GC 停顿经典案）与 fencing 的必要性。仲裁节点（第三方 witness——2 节点+1 仲裁的省钱布局）。网络分区类型（部分/闪断）与跨机房 quorum 的延迟代价。
