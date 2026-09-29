---
id: 01M3NDKAWG02XR7GZ4F436Z7BM
blockId: rpc/distributed-coord
relatedBlocks:
  []
question: "CAP 和 BASE 理论？"
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - P 为什么不是三选二？
keyPoints:
  - id: kp-dc5-1
    text: "CAP：分区必现时，一致性 C 与可用性 A 二选一"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-dc5-2
    text: "P 是前提：网络分区不是选项而是常态（必须容忍）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-dc5-3
    text: "BASE：Basically Available + 软状态 + 最终一致——AP 路线的工程化"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-dc5-4
    text: "最终一致：停止更新后经过有限时间达成一致"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-dc5-5
    text: "实践：按业务逐点选（账户余额 CP、商品浏览量 AP）——不是系统级单选"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
---

**CAP** 说的是**分区（P）发生时**你只能在 **C（一致性）** 和 **A（可用性）** 里挑一个：

- **P 不是选项**：网络分区（交换机抖动/跨机房断链）**不是你选不选，是必然会来**——系统必须容忍 P（复制数据就是为此）；
- 分区那一刻：**选 C**（拒绝不一致的写入——少数派不可用，ZK）或**选 A**（各自继续服务，恢复后对账——数据可能冲突，Eureka/Distro）；
- **没分区时** C 和 A 可以兼得——CAP 讲的是**坏天气的取舍**。

**BASE** 是 AP 路线的工程化宣言：**基本可用**（降级损功能保核心）+ **软状态**（允许中间态——「处理中」）+ **最终一致**（有限时间内收敛）。

**实践口径**：**按数据项逐个选**而非整系统一刀切——账户余额选 CP（错一分钱是事故），商品浏览量选 AP（少算一次无妨）。

**术语速查**：分区=网络断了各自为政｜坏天气取舍=分区时的二选一｜逐点选=每个数据各自定 CAP

<!--advanced-->
一致性的光谱（线性一致→顺序一致→因果→会话→最终——性能递增约束递减）。-quorum（W+R>N 的可调一致性）。PACELC（无分区时延迟与一致性的第二重取舍）。
