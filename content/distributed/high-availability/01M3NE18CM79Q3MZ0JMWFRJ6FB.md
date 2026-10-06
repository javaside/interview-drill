---
id: 01M3NE18CM79Q3MZ0JMWFRJ6FB
blockId: distributed/high-availability
relatedBlocks: []
question: 限流算法部署在哪一层？
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - 单机限流和集群限流的差？
keyPoints:
  - id: kp-ha4-1
    text: 客户端限流：防自己打垮下游（sdk 令牌桶）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ha4-2
    text: 网关限流：全局入口闸（按 API/用户/租户）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ha4-3
    text: 服务端限流：自我保护（sentinel 每机）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ha4-4
    text: 分布式限流：Redis+lua 或集群流控 server（全局面额）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ha5-5
    text: 多层配额：全局>应用>接口>用户 层层分摊
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

限流器放哪里 = **保护谁、按什么口径数**：

- **客户端 SDK**：出发前自查（本地令牌桶）——**防自己突袭下游**（调第三方接口配额）；
- **网关**：系统总闸——按 API/用户/租户口径（超卖黑名单在这层）；
- **服务实例本地**：Sentinel 单机模式——**保自己**（线程/并发数），但阈值是「单机额度」，扩缩容后总量漂移；
- **集群流控**：全局总额度——Redis+lua 原子取令牌（每请求一跳网络）或 Sentinel 集群 server（token server 分发额度给各实例本地花——性能与全局的折中）。

**实践**：**多层配额制**——全局（网关）10000 QPS → 每应用 3000 → 每实例 = 3000/实例数 → 突发用户级（每 uid 10 QPS）层层分摊，局部爆炸不伤全局。

**术语速查**：客户端=出发自查｜集群额度=全局一个账本｜层层分摊=配额金字塔

<!--advanced-->
Redis lua 原子性的依赖与网络单跳成本；集群流控的 token server 高可用。热点参数限流（某 uid 突发——按参数维度单独闸）。网关层与 CDN 缓存对限流压力的削峰。
