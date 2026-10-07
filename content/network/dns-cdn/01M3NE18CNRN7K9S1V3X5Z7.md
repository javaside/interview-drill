---
id: 01M3NE18CNRN7K9S1V3X5Z7
blockId: network/dns-cdn
relatedBlocks: []
question: DNS 记录类型有哪些、TTL 怎么权衡？
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - 迁移机房前 TTL 该怎么调？
  - CNAME 为什么不能与其他记录共存？
keyPoints:
  - id: kp-dn5-1
    text: A/AAAA：域名到 IPv4/IPv6 地址——解析的终点
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn5-2
    text: CNAME：别名指向另一个域名——CDN/多层调度的基础
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNRJ1C3E5G7K9S1V
      - 01M3NE18CNRK3E5G7K9S1V3
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn5-3
    text: MX/NS/TXT：邮件路由/域的管理者/扩展信息（SPF/DKIM/验证）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn5-4
    text: TTL 大：缓存多负载小，但切换生效慢
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNRJ1C3E5G7K9S1V
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn5-5
    text: TTL 小：切换快，但解析压力与故障半径变大
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNRJ1C3E5G7K9S1V
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
---

常用记录一张图：

| 记录 | 作用 | 场景 |
|---|---|---|
| **A / AAAA** | 域名 → IPv4 / IPv6 地址 | 最终答案 |
| **CNAME** | 域名 → 另一域名 | **CDN 接入、多级调度**（www → CDN 域名） |
| **MX** | 邮件服务器 | 收发邮件 |
| **NS** | 谁管这个域的解析 | 委派（域名换 DNS 服务商） |
| **TXT** | 自由文本 | **SPF/DKIM 防伪造、域名所有权验证** |

**TTL 的跷跷板**：调大（如 24h）→ 缓存命中率高、权威负载小、用户解析快；代价是**变更传播慢**（改记录最长 TTL 后才全量生效）。调小（60s）→ 切换灵活；代价是缓存穿透频繁、解析链压力上升、DNS 抖动的影响面扩大。

**迁移的标准动作**：提前 24h 把 TTL 从 3600 降到 60 → 切换（全网 1 分钟内生效）→ 稳定后调回 3600。**注意 CNAME 不能与其他记录共存于同一域名**（区文件规则——根域名有 NS/SOA 记录，所以「根域名套 CDN」得用 ALIAS/ flattening 技巧）。

**术语速查**：A=终点站|CNAME=换乘站|TTL=改主意的提前量

<!--advanced-->
ALIAS/ANAME（根域名 CNAME 展平——由 DNS 服务商实时解析并返回 A 记录）。Split-horizon DNS（内外网同域名不同答案）。DNS over UDP 512 字节限制与 TC 位触发 TCP 重查。
