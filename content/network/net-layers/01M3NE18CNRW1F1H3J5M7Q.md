---
id: 01M3NE18CNRW1F1H3J5M7Q
blockId: network/net-layers
relatedBlocks: []
question: OSI 七层和 TCP/IP 四层各是什么？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - TLS 算哪一层？
  - 为什么模型是四层不是五层六层？
keyPoints:
  - id: kp-nl1-1
    text: TCP/IP 四层：应用（HTTP/TLS）→ 传输（TCP/UDP）→ 网络（IP）→ 链路（以太网）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
  - id: kp-nl1-2
    text: OSI 七层把应用侧再细分：会话/表示层，链路拆数据链路+物理
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
  - id: kp-nl1-3
    text: 分层价值：各层只依赖下层的接口，换实现互不影响
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
  - id: kp-nl1-4
    text: 数据封装：每层给上层数据加自己的头（段→包→帧）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
  - id: kp-nl1-5
    text: 面试实务按四层答，对照七层补会话/表示即可
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
---

工业界活的是 **TCP/IP 四层**，教科书考的是 **OSI 七层**——对照着记：

```
OSI 七层            TCP/IP 四层       协议举例
应用 ──────┐
表示       ├────  应用层          HTTP/DNS/TLS*
会话 ──────┘
传输 ───────────  传输层          TCP/UDP
网络 ───────────  网络层          IP/ICMP
数据链路 ─┐
          ├────  链路层          以太网/ARP/WiFi
物理 ─────┘
```

（*TLS 严格说被设计在会话/表示之间——实务当应用层的一部分讲。）

**分层的第一性价值**：**关注点分离 + 接口稳定**。IP 层不用管上面是 HTTP 还是 Redis 协议；TCP 换拥塞算法 HTTP 无感；WiFi 换 5G，TCP/IP 原样跑。每层只对上层承诺「给你什么服务」，只对下层索取「你给我什么能力」——**互联网能演化的根基**。

**封装视角**：发数据像套信封——HTTP 报文套 TCP 头（**段**）套 IP 头（**包**）套帧头帧尾（**帧**）；接收端逐层拆封。各层的名字（段/包/帧）就来自这里。

**术语速查**：四层是实态、七层是理论|段包帧=各层的信封|接口稳定=换内核不换应用

<!--advanced-->
五层教学模型（把物理从链路拆出——国内教材常用）。层违规的经典（QUIC 在 UDP 上重建可靠传输=应用层干传输层的活——中间设备僵化的倒逼）。跨层优化的争议。
