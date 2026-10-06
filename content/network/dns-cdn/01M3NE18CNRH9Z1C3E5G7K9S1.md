---
id: 01M3NE18CNRH9Z1C3E5G7K9S1
blockId: network/dns-cdn
relatedBlocks: []
question: DNS 域名解析的完整流程？
cardType: sequence
appliesTo: 通用
frequency: high
followUps:
  - 递归查询和迭代查询的区别？
  - 为什么要有 TTL？
keyPoints:
  - id: kp-dn1-1
    text: 查本地缓存链：浏览器 → 系统 hosts → 本地 DNS 服务器
    public: false
    order: 1
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn1-2
    text: 本地 DNS 未命中问根服务器：给出顶级域（.com）地址
    public: false
    order: 2
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn1-3
    text: 问顶级域服务器：给出权威 DNS 的地址
    public: false
    order: 3
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn1-4
    text: 问权威 DNS：拿到域名 A 记录的正式答案
    public: false
    order: 4
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
  - id: kp-dn1-5
    text: 本地 DNS 缓存结果（按 TTL）并返回客户端
    public: false
    order: 5
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1034.html
      locator: RFC 1034
---

浏览器敲入域名到拿到 IP，是一条**逐级甩锅**的流水线：

```
浏览器缓存 → OS 缓存/hosts → 本地 DNS（运营商/8.8.8.8）
                                  │ 未命中，替你迭代问路：
                                  ├→ 根服务器：「.com 归谁管？」→ 给 .com 服务器地址
                                  ├→ .com 服务器：「example.com 归谁管？」→ 给权威 DNS 地址
                                  └→ 权威 DNS：「example.com 的 A 记录是 93.184.216.34」
本地 DNS 按 TTL 缓存答案 → 返回客户端 → 客户端也缓存
```

**两种查询角色**：客户端→本地 DNS 是**递归**（你必须给我最终答案）；本地 DNS→各级是**迭代**（我问一句你答一句，剩下的路我自己走）。**负载与缓存的设计**：每级答案都带 **TTL**——权威改记录后，全网最长 TTL 时间内仍可能有旧答案（所以改 DNS 记录前**先把 TTL 调小**，生效后再恢复）。

**术语速查**：递归=全权代办|迭代=只指路不带路|TTL=答案的可信保质期

<!--advanced-->
根服务器的 13 个 IP（任播扩散成上百节点）。负缓存（NXDOMAIN 也缓存——防不存在的域名反复穿透）。EDNS Client Subnet（把客户端网段带给权威——CDN 智能调度的前提）。
