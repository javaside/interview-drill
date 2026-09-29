---
id: 01M3NE18CNRD1R3T5V7X9Z1
blockId: network/tcp-troubles
relatedBlocks:
  []
question: "TCP 粘包拆包怎么产生、怎么解决？"
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - UDP 会粘包吗？
  - 应用层 read 一次能读完整消息吗？
keyPoints:
  - id: kp-tt2-1
    text: "根源：TCP 是字节流——没有消息边界，「包」的概念不存在"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'RFC 9293'
  - id: kp-tt2-2
    text: "粘=多条消息一次读到；拆=一条消息分多次读到"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'RFC 9293'
  - id: kp-tt2-3
    text: "Nagle 与接收缓冲攒批放大了粘的几率"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'RFC 9293'
  - id: kp-tt2-4
    text: "解法定长：每消息固定字节——简单浪费"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'RFC 9293'
  - id: kp-tt2-5
    text: "解法分隔符/长度前缀：TLV 头声明体长（主流 RPC 通用做法）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'RFC 9293'
---

**「粘包」是个假问题真现象**：TCP 从承诺过「按发送的分次送达」——它只保证**字节流有序完整**，一次 send 可能被拆几段、几次 send 可能被合一段（Nagle 攒小包、MSS 分段、接收缓冲一次 recv 捞到多条）。**边界是应用层自己的契约**，TCP 无从知晓。

三种定界方案：

| 方案 | 做法 | 代价 |
|---|---|---|
| **定长** | 每消息固定 N 字节，不足补齐 | 简单粗暴，短消息浪费带宽 |
| **分隔符** | 特殊字符标记结尾（如 \n、\r\n——Redis 协议用） | 内容需转义，扫描成本 |
| **长度前缀（TLV）** | 头部声明类型+长度，再读定长 body（HTTP Content-Length、几乎所有 RPC 框架） | 最通用——**先读头知道体长，再精确收齐体** |

**UDP 不粘**：它是**数据报**协议——一次 sendto 对应一次 recvfrom，边界由内核保留（代价是丢/乱序自担）。

**术语速查**：字节流=没有句号的信|TLV=先报长度再发货|recv 环=读到「够一条」才交业务

<!--advanced-->
recv 语义的坑：返回 n 只是「缓冲区有 n 字节」，不保证消息完整——必须有「未决缓冲区 pending buffer」循环拼接。Redis RESP 的换行分隔与 HTTP 的 Content-Length/chunked 双模式。Netty LengthFieldBasedFrameDecoder 即产品化 TLV。
