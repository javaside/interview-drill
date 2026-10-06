---
id: 01M3NE18CNRM5G7K9S1V3X5
blockId: network/dns-cdn
relatedBlocks: []
question: DNS 劫持和 DNS 污染怎么区分、怎么防？
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - 为什么污染防不胜防？
  - HTTPDNS 为什么 APP 都在用？
keyPoints:
  - id: kp-dn4-1
    text: 劫持：掌握 DNS 权限的人（运营商/路由器）返回假答案
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn4-2
    text: 污染：旁路伪造响应抢答——比真答案先到即得逞
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn4-3
    text: 共同危害：用户被引到假站点（钓鱼/插广告）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn4-4
    text: 根治方向：让 DNS 答案无法伪造——DNSSEC 签名验证
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn4-5
    text: 工程绕法：DoH/DoT 加密 DNS 查询，或 HTTPDNS 走 HTTP 通道
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
---

两个「假答案」来源不同：

- **DNS 劫持**：攻击者**合法地掌握**了 DNS 链路某环（运营商 LocalDNS 的缓存投毒、黑心路由器改配置）——返回的假答案**本身格式合法**，你无从分辨，只看他有没有权限。典型症状：页面插运营商广告、域名跳导航站；
- **DNS 污染（缓存投毒/抢答）**：攻击者是**旁路**（不掌握链路，只监听+伪造）——DNS 是**明文 UDP、无验证**，它抢在真答案之前回一个伪造响应（ Transaction ID 猜中即赢），LocalDNS 把假答案缓存住，全网中招。

**防的思路两条**：①**验证答案真伪**——**DNSSEC**（权威对记录签名，解析器逐级验签——根治但部署慢）；②**藏起查询本身**——**DoH/DoT**（DNS over HTTPS/TLS——旁路看不到你问了什么，没法抢答）、**HTTPDNS**（绕开 UDP 53 直接 HTTP 请求 DNS 服务——**APP 侧事实标准**：解析器自带 SDK，还可附带精准调度与连通性探测）。

**术语速查**：劫持=有权的人说谎|污染=没权的人抢答|加密查询=让你听不见问题

<!--advanced-->
Transaction ID 与源端口弱化的熵（16+16bit—— birthday 碰撞攻击）。Kaminsky 攻击与 0x20 编码随机化。企业侧的防护（可信 resolver 白名单+证书透明度发现劫持）。
