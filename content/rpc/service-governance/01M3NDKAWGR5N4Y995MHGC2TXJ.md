---
id: 01M3NDKAWGR5N4Y995MHGC2TXJ
blockId: rpc/service-governance
relatedBlocks: []
question: 令牌桶和漏桶的区别？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 秒杀场景选哪个？
keyPoints:
  - id: kp-sg2-1
    text: 漏桶：恒定速率流出——绝对整流（不许突发）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-sg2-2
    text: 令牌桶：恒速放令牌入桶，请求拿到令牌才走——允许攒额度后的突发
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-sg2-3
    text: 桶=缓冲容量：满了拒绝/排队
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-sg2-4
    text: Guava RateLimiter 即令牌桶；Nginx limit_req 是漏桶风格（burst 缓冲）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

两种**整流器**，差在**对突发的态度**：

- **漏桶**：水以**恒定速率**流出——不管进来多猛，出去永远匀速（削峰成直线）；**绝对平滑**但浪费（突发能力为零）——适合**保护脆弱的下游**（数据库写入匀速化）；
- **令牌桶**：匀速往桶里放**令牌**（空闲时攒着），请求拿到令牌即走——**允许短暂突发**（攒了 100 个令牌可瞬间放行 100）——适合**业务允许抖动**的入口（正常波动不误伤）。

**秒杀**：入口用**令牌桶**（放突发通过预热的桶），落库前用**漏桶**（匀速写 DB）——两段组合。

**术语速查**：整流=把洪峰削匀｜攒令牌=允许突发额度｜两段组合=入口突发+出口平滑

<!--advanced-->
分布式限流（单机桶的集群版：Redis+lua 的原子取令牌 / Sentinel 集群流控 server）。冷启动令牌（warmup：冷桶低速率渐进抬升）。RateLimiter 的 SmoothBursty/SmoothWarmingUp。
