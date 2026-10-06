---
id: 01M3NE18CNRJ1C3E5G7K9S1V
blockId: network/dns-cdn
relatedBlocks: []
question: DNS 能做负载均衡吗？怎么做？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - DNS 轮询的分流准吗？
  - 为什么 CDN 都用 CNAME 接入？
keyPoints:
  - id: kp-dn2-1
    text: 轮询 A 记录：一个域名多条 A，DNS 依次返回——最简朴
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn2-2
    text: 权重/地理调度：权威 DNS 按来源网段返回就近机房 IP
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn2-3
    text: CDN 的 CNAME 接力：域名 CNAME 到 CDN，由 CDN 调度
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn2-4
    text: 局限：DNS 只管「给你哪个 IP」，不管那个 IP 活没活着
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn2-5
    text: 健康检查要靠动态 DNS（改记录）或前置 LB 补位
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
---

DNS 天生就是个**全球分布式的调度器**，四层用法逐级增强：

- **轮询 A 记录**：`example.com → A: 1.1.1.1 / 2.2.2.2 / 3.3.3.3`——DNS 服务器轮转顺序返回。**粗粒度**：不感知服务健康（一台挂了照发）、不感知负载与地理（澳洲用户拿到美国 IP）、客户端缓存让分流不匀；
- **地理/智能调度**：权威 DNS（如云厂商 DNS）按**请求来源网段**返回就近机房——「华东用户拿上海 IP、海外拿新加坡 IP」；进阶加权（按机器容量配比返回不同记录）；
- **CNAME 接力（CDN 标准姿势）**：`www.example.com CNAME www.example.cdn.com`——把「选 IP」这件事**外包给 CDN 的调度系统**（它有全网探测数据与精确到城市运营商的视图）；
- **健康感知**要靠 **动态 DNS**：探活系统发现节点宕机 → 调 API 摘记录——但受 **TTL 生效延迟**限制（分钟级），秒级故障切换得靠前置 **LB（L4/L7）** 补位。

**术语速查**：轮询=依次报地址|智能调度=看人下菜|CNAME 接力=调度外包

<!--advanced-->
GeoDNS 的实现（最大mind 库——IP 地理库的精度边界）。GSLB 全局负载均衡（DNS+HTTP 重定向+F5 GTM 的混合）。DNS 调度 vs LB 调度的时延差（TTL 分钟级 vs 秒级健康检查）。
