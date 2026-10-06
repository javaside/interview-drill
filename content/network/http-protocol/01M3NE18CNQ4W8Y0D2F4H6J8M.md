---
id: 01M3NE18CNQ4W8Y0D2F4H6J8M
blockId: network/http-protocol
relatedBlocks: []
question: HTTP/1.1、HTTP/2、HTTP/3 各解决了什么？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 多路复用为什么救不了 TCP 队头阻塞？
  - 为什么 QUIC 选 UDP 而不改 TCP？
keyPoints:
  - id: kp-hp3-1
    text: 1.1：长连接+管道化复用 TCP，但队头阻塞在 HTTP 层（响应串行）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: RFC 9110
  - id: kp-hp3-2
    text: 2.0：二进制分帧+多路复用，一个 TCP 并行多流——消 HTTP 队头
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: RFC 9110
  - id: kp-hp3-3
    text: 2.0 遗症：TCP 层队头阻塞（丢一个包全员卡）+TLS 指纹被识别
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: RFC 9110
  - id: kp-hp3-4
    text: 3.0：换 QUIC（UDP 上重建可靠多路复用+内建 TLS 1.3）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: RFC 9110
  - id: kp-hp3-5
    text: 3.0 连接迁移：用 Connection ID 标识连接，换网不断流
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: RFC 9110
---

每一代都在拆上一代的墙：

- **HTTP/1.1**：默认 **keep-alive 长连接**省握手；但响应必须**按序返回**（管道化失败告终）——一个慢响应堵住整条连接，即 **HTTP 层队头阻塞**。浏览器的土办法：开 6 个并行连接；
- **HTTP/2**：**二进制分帧**（报文拆帧可交错）+ **多路复用**——一个 TCP 连接上 N 个流并行，头压缩 HPACK 省重复头部。**但 TCP 层队头阻塞浮出水面**：TCP 保证字节流有序，**丢 1 个包，后面已到的帧也得候着重传**——所有流一起卡；
- **HTTP/3（QUIC）**：干脆把可靠传输搬到 **UDP 上重建**——流之间**独立有序**（丢包只堵自己那条流）；内建 **TLS 1.3**（握手合并省 RTT）；**连接迁移**用 Connection ID 识别连接（手机 WiFi 切 4G，IP 变了连接不断）。

**为什么不改 TCP 而绕道 UDP**：TCP 在内核、中间盒（NAT/防火墙）已固化行为，升级要全世界设备换代——UDP 载荷在用户态，** QUIC 在应用层就能迭代**。

**术语速查**：队头阻塞=一个慢堵一队｜分帧=报文拆乐高｜连接迁移=认 ID 不认 IP

<!--advanced-->
HPACK 与 QPACK 的差异（2.0 头压缩依赖流的有序性——3.0 得重做）。0-RTT 的重放风险（只放幂等请求）。QUIC 的用户态实现代价（CPU/无硬件卸载）与收益（TCP Fast Open 从未普及 vs QUIC 落地即用）。
