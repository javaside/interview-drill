---
id: 01M3NE18CM14GQSBX70PZXA4C7
blockId: distributed/arch-evolution
relatedBlocks:
  []
question: "单体到微服务的演进动机？"
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 微服务拆得越细越好吗？
keyPoints:
  - id: kp-ae1-1
    text: "单体：开发简单部署简单——小团队最快路径"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ae2-2
    text: "痛点随规模到来：一改全发、故障牵连、技术栈锁死"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ae1-3
    text: "微服务：独立部署/扩展/技术栈——代价是分布式复杂度"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ae1-4
    text: "演进节奏：先模块化单体（好拆）→ 团队规模到了再拆"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
---

**不是革命是演进**——规模决定形态：

- **单体**：一个进程一个库——**小团队/早期产品**的最快路径（无网络开销、事务简单、调试一把梭）；
- **规模大了的病**：代码百万行谁都不敢动、**一改全发**（一个模块 bug 拖死全站发布）、一个慢模块拖垮整个进程、技术栈锁死；
- **微服务**：按业务域拆独立部署——**独立扩展**（订单 100 台、用户 10 台）、故障隔离、团队自治（康威定律的正面利用）。**代价清单**也一页纸：分布式事务/网络不可靠/链路排障/运维成本——**拆之前先确认自己养得起**。

**中间形态**：**模块化单体**（单进程内高内聚低耦合的模块+清晰接口）——保留简单性、**保持可拆性**——等团队/流量真到再拆（很多「微服务」其实是 premature distribution 的过度设计）。

**术语速查**：一改全发=单体的发布病｜康威定律=组织结构映射架构｜模块化单体=可拆而未拆

<!--advanced-->
拆分依据（DDD 限界上下文/变化频率/团队归属）。分布式单体的反模式（拆了但共享库+同步链——复杂度全收好处全无）。service mesh/serverless 的「不侵入」演进方向。
