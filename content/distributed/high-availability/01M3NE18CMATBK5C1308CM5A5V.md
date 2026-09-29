---
id: 01M3NE18CMATBK5C1308CM5A5V
blockId: distributed/high-availability
relatedBlocks:
  []
question: "异地多活怎么做？"
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 为什么要单元化？
keyPoints:
  - id: kp-ha2-1
    text: "多机房同时提供服务——单机房故障秒级切流"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ha2-2
    text: "核心难点：数据双向同步的冲突（两地同时改一条数据"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ha3-3
    text: "主流解：单元化——按用户分片路由到固定机房（封闭修改）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ha2-4
    text: "数据异步互备 + 冲突按时间戳/业务规则收敛"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ha2-5
    text: "全局服务（库存/账户）集中部署或按业务分片"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
---

**异地多活**=两地三中心同时服务（不是冷备热备——**都干活**）——机房级故障（断电/光纤/火灾）时**把流量切到活着的机房**，用户几乎无感。

**核心难题：数据**。两地都能写 → 同一条数据两地同时改 → **双向同步冲突**。**单元化**（set 化）是主流解：

- 按**用户维度分片**（uid 尾号路由）：北京单元服务北方用户、上海单元服务南方用户——**每个用户的写只发生在一个机房**（封闭修改，冲突根源消失）；
- 数据**异步双向复制**互为备份（故障时对方接手）；
- **全局强一致数据**（库存、账户总账）单独处理：集中部署单元回源 / 或按业务再分片（商品维度切）。

**术语速查**：单元化=用户归属固定机房｜封闭修改=一个用户只在一地写｜切流=DNS/GSLB 秒级导流

<!--advanced-->
流量入口调度（GSLB/DNS 智能解析+httpdns）。数据同步通道（otter/drc 的双向+防环回）。单元化路由的容错（本单元故障时跨单元接管的一致性代价）。
