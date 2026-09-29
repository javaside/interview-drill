---
id: 01M3NE18CNP8W2X4Y6Z8B0D2F4H
blockId: network/tcp-connection
relatedBlocks:
  []
question: "TCP 四次挥手的流程？为什么比握手多一次？"
cardType: sequence
appliesTo: 通用
frequency: high
followUps:
  - TIME_WAIT 为什么是 2MSL？
  - 被动方迟迟不发 FIN 会怎样？
keyPoints:
  - id: kp-tc2-1
    text: "第 1 步 主动方发 FIN 进 FIN_WAIT_1，表示不再发数据"
    public: false
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
  - id: kp-tc2-2
    text: "第 2 步 被动方回 ACK，进入半关闭：收发只剩单向"
    public: false
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
  - id: kp-tc2-3
    text: "第 3 步 被动方把剩余数据发完，再发自己的 FIN"
    public: false
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
  - id: kp-tc2-4
    text: "第 4 步 主动方回 ACK 并进 TIME_WAIT，滞留 2MSL 后关闭"
    public: false
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
---

断连比建连多一个包，根源是** TCP 允许半关闭**：收到对方的 FIN 只说明**对方不发了**，不代表**自己发完了**——被动方的 ACK（确认收尾）和 FIN（自己收尾）中间可能还隔着一批没发完的数据，只能拆成两步：

```
主动方 → FIN →            （我 说完了）
被动方 ← ACK ←            （知道了，我还没说完）
被动方 ← FIN ←            （我也说完了）
主动方 → ACK → 进 TIME_WAIT（滞留 2MSL 再 CLOSED）
```

**TIME_WAIT 滞留 2MSL**（报文最大生存时间的两倍）双保险：①最后的 ACK 若丢，对方会重发 FIN，主动方还能补答——立刻关闭就会回 RST 让对方异常；②让本连接的旧报文在网络里自然死亡，不会串进**复用同四元组**的新连接。

**术语速查**：半关闭=单行道｜FIN=我说完了｜2MSL=旧报文的寿限

<!--advanced-->
大量 TIME_WAIT 的来源（主动断连方留痕——HTTP 短连接、爬虫、LB 主动 RST）。tcp_tw_reuse 仅客户端（带 timestamp 判断安全）。SO_REUSEADDR 让监听端口立刻重绑。close 与 shutdown 的差别（close 全双工一刀两断，shutdown 可只关写方向）。
