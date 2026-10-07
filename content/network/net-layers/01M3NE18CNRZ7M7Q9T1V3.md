---
id: 01M3NE18CNRZ7M7Q9T1V3
blockId: network/net-layers
relatedBlocks: []
question: 短连接、长连接、WebSocket 怎么选？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - SSE 和 WebSocket 怎么选？
  - 长连接的空闲怎么治理？
keyPoints:
  - id: kp-nl4-1
    text: 短连接：每请求建连断连——简单但握手与 TIME_WAIT 成本高
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNQ4W8Y0D2F4H6J8M
      - 01M3NE18CNRC9P1R3T5V7X9
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
  - id: kp-nl4-2
    text: 长连接：keep-alive 复用 TCP——HTTP/1.1 默认，配合连接池
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNQ4W8Y0D2F4H6J8M
      - 01M3NE18CNRC9P1R3T5V7X9
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
  - id: kp-nl4-3
    text: WebSocket：TCP 上全双工消息协议——服务器可主动推
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
  - id: kp-nl4-4
    text: 升级路径：HTTP 先握手 101 Switching Protocols 再转 WS
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNQ3V7X9Z1C3E5G7K
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
  - id: kp-nl4-5
    text: 选型：请求响应用长连接；双向实时（IM/行情/协同）用 WS 或 SSE
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
---

三档连接策略，按**「连接成本」和「通信方向」**两个维度选：

- **短连接**（一问一答即断）：实现最简单，但每请求 3 次握手+4 次挥手+主动方 TIME_WAIT——高频调用下端口与内存被拖垮（微服务间裸 HTTP 的反模式）；
- **长连接**（keep-alive/连接池）：**建连成本摊销到 N 个请求**——HTTP/1.1 默认开启；RPC 框架（Dubbo/gRPC）天然是长连接+多路复用。注意配套治理：**空闲超时、心跳保活、连接上限**（对端/中间盒清表会让长连接变半开——心跳是长连接的养命钱）；
- **WebSocket**：为「**服务器主动推**」而生——HTTP 发起 `Upgrade: websocket`（101 状态码切换协议）后，TCP 变成**全双工消息通道**（有自己的帧格式：opcode 分文本/二进制/心跳 ping-pong）。适合 IM、行情推送、协同编辑。

**别忽略轻量替代 SSE**：服务端单向推（AI 流式输出、通知）用 **SSE**（一个长 HTTP 响应流 text/event-stream）——纯 HTTP 语义、自动重连、过代理友好；只有**客户端也要高频回传**才值得上 WebSocket。

**术语速查**：连接复用=摊销握手|全双工=同时双向说|SSE=HTTP 里的单向喇叭

<!--advanced-->
HTTP/2 的流与 WS 的帧（同为单连接多路复用的两条路线）。WS 过代理（Upgrade 头被中间盒吞——wss+80/443 的现实）。gRPC 的 HTTP/2 流 vs WS——双向流的两种生态。
