---
id: 01M3NDKAWG8XB86HYWEEYE5JPF
blockId: rpc/service-governance
relatedBlocks:
  []
question: "分布式链路里的灰度发布怎么做？"
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: mid
followUps:
  - 金丝雀和蓝绿有什么区别？
keyPoints:
  - id: kp-sg5-1
    text: "按标记路由：请求带 tag（用户组/地域/设备），全链路同 tag 服务互调"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-sg5-2
    text: "网关注入标记；RPC 框架按标记选实例（泳道隔离）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-sg5-3
    text: "权重分流：无标记流量按比例（5%→30%→100%）渐进"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-sg5-4
    text: "观测先行：灰度组 vs 对照组的错误率/延迟对比，异常即回切"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
---

**灰度发布=新版先给一小撮人用**，错了影响面小、可回退：

1. **标记路由（泳道）**：网关按规则（内部员工/1% 用户/某地域）打 **tag**；RPC 调用**沿 tag 传递**——带 tag 的请求全链路只打同 tag 的新版实例（「**泳道**」：独立的一条链路），无 tag 的走稳定版；
2. **权重灰度**：不打标就按比例分流（5% 流量到 v2）——观察指标逐步放大；
3. **观测+回切**：灰度组与对照组的**错误率/P99/业务指标**实时对比——异常自动（或人工）切回。

**金丝雀 vs 蓝绿**：金丝雀=**新旧共存逐步放量**（省资源、可精细观察）；蓝绿=**两套全量环境切换**（回退快如开关、但双倍资源且数据库 schema 兼容要求高）。

**术语速查**：泳道=同 tag 的独立链路｜放量=比例逐步抬升｜对照组=同口径的老版基线

<!--advanced-->
全链路灰度的标记透传（tag 进 RPC 上下文/MQ header——一处遗漏即串道）。feature flag 与灰度的组合（代码全量+功能开关控制）。数据兼容（新旧 schema 并存的扩展策略）。
