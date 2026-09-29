---
id: 01M3NE18CNRK3E5G7K9S1V3
blockId: network/dns-cdn
relatedBlocks:
  []
question: "CDN 的工作原理？"
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 回源风暴怎么防？
  - 动态内容怎么办 CDN？
keyPoints:
  - id: kp-dn3-1
    text: "接入：源站域名 CNAME 到 CDN 域名，调度系统选边缘节点"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: 'RFC 1034'
  - id: kp-dn3-2
    text: "命中：边缘节点缓存有内容直接返回——用户到源站的 RTT 变成到边缘"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: 'RFC 1034'
  - id: kp-dn3-3
    text: "未命中回源：边缘去源站拉一份，缓存住再返回"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: 'RFC 1034'
  - id: kp-dn3-4
    text: "缓存键与过期：URL 为键，TTL/Cache-Control 控制，刷新可强制"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: 'RFC 1034'
  - id: kp-dn3-5
    text: "价值三合一：降延迟（就近）、扛流量（边缘分担）、省源站带宽"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: 'RFC 1034'
---

CDN = **把内容搬到离用户最近的机房**。核心三步：

```
①接入：www.example.com CNAME → www.example.cdn.com（DNS 调度交给 CDN）
②调度：CDN 权威 DNS 按用户网段返回「就近边缘节点」IP
③服务：边缘有缓存 → 直接返回（命中）
        没缓存 → 回源站拉取 + 落缓存 + 返回（MISS 后变 HIT）
```

**降延迟的账**：用户到源站 RTT 50ms（跨省）→ 用户到边缘 5ms（同城），首字节时间骤降；**扛流量的账**：百万用户打边缘节点（分布式扛住），回源流量被高命中率的缓存挡掉——源站只见到 MISS 的涓涓细流。

**运维抓手**：**缓存键**（默认 URL，可配忽略查询参数）／**过期**（继承源站 Cache-Control、边缘覆盖 s-maxage）／**刷新**（主动失效——发版后预热+刷新）。

**回源风暴**：热点 URL 过期瞬间成百边缘节点同时回源——防御 **边缘节点间的中继回源**（层层收敛）与**源站 shielding**（指定一个中间层统一回源）。

**术语速查**：边缘节点=搬到门口的仓|回源=门口没货去总仓调|命中率=CDN 的命根

<!--advanced-->
动态加速（没有缓存价值的 POST/接口——靠边缘到源站的专线+连接复用+路由优化）。全站加速（动静态混合）与边缘计算（Cloudflare Workers——逻辑也搬边缘）。多级缓存架构（L1 边缘-L2 区域-源站的漏斗）。
