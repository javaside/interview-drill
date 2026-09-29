---
id: 01M3NE18CNP7Q4R9T2KVX3WZAB
blockId: network/tcp-connection
relatedBlocks:
  []
question: "TCP 三次握手的流程？为什么不是两次？"
cardType: sequence
appliesTo: 通用
frequency: high
followUps:
  - 两次握手会出什么事故？
  - 初始 seq 为什么随机？
keyPoints:
  - id: kp-tc1-1
    text: "第 1 步 客户端发 SYN（seq=x），进 SYN_SENT 状态"
    public: false
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
  - id: kp-tc1-2
    text: "第 2 步 服务端回 SYN+ACK（seq=y，ack=x+1），进 SYN_RCVD"
    public: false
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
  - id: kp-tc1-3
    text: "第 3 步 客户端回 ACK（ack=y+1），双方 ESTABLISHED"
    public: false
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
  - id: kp-tc1-4
    text: "三方的目的：双方各确认一次「你能收我能发」，同步初始序号"
    public: false
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
  - id: kp-tc1-5
    text: "防历史连接：旧 SYN 迟到时三次握手的最后一次 ACK 可拒掉"
    public: false
    order: 5
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
---

三次握手像打电话确认线路：「喂，听得到吗？」「听得到，你能听到我吗？」「能，开始说」——**每方都要确认「我发的你能收、你发的我能收」**，这件事最少三个包：

```
客户端 → SYN(seq=x)        →            服务端 SYN_RCVD 前是 LISTEN
客户端 ← SYN+ACK(seq=y,ack=x+1) ←       双方都知道对方序号起点
客户端 → ACK(ack=y+1) →                双方 ESTABLISHED
```

**为什么不是两次**：若两次即成，一个**网络里滞留的旧 SYN**（上条已断连接的重复报文）迟到抵达，服务端回个 ACK 就单方面建连——**资源被历史报文凭空占用**，之后发的数据全被丢弃。三次握手下，客户端不会对旧连接回 ACK，服务端收不到第三次握手就超时放弃。**初始 seq 随机**还有一层：防第三方**猜序号**伪造报文插入数据（RST 攻击的前置条件）。

**术语速查**：SYN=请求同步序号｜ESTABLISHED=双方就绪｜历史连接=旧报文迟到作祟

<!--advanced-->
SYN Flood：攻击者只发 SYN 不回 ACK，服务端半连接队列爆满——防御 syncookies（把状态编码进 seq 返回，不占队列）。TCP Fast Open（TFO）在 SYN 携数据省一个 RTT。半连接/全连接队列（syn_backlog 与 accept 队列）的溢出表现。
