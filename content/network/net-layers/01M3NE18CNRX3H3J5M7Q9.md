---
id: 01M3NE18CNRX3H3J5M7Q9
blockId: network/net-layers
relatedBlocks:
  []
question: "从输入 URL 到页面展示，中间发生了什么？"
cardType: sequence
appliesTo: 通用
frequency: high
followUps:
  - 哪几步可缓存加速？
  - 渲染里哪步最耗时？
keyPoints:
  - id: kp-nl2-1
    text: "DNS 解析拿 IP：缓存链→本地 DNS→根/顶级/权威迭代"
    public: false
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: 'RFC 1122'
  - id: kp-nl2-2
    text: "TCP 三次握手建连（HTTPS 再叠 TLS 握手）"
    public: false
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: 'RFC 1122'
  - id: kp-nl2-3
    text: "发 HTTP 请求经路由逐跳转发到服务器"
    public: false
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: 'RFC 1122'
  - id: kp-nl2-4
    text: "服务端处理：LB→网关→应用→DB，回 HTTP 响应"
    public: false
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: 'RFC 1122'
  - id: kp-nl2-5
    text: "浏览器解析渲染：HTML→DOM、CSS→CSSOM→布局绘制"
    public: false
    order: 5
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: 'RFC 1122'
---

这道题是**整门网络的地图**——每一步都通向一个专题：

```
①DNS     ：浏览器缓存→hosts→LocalDNS→根→.com→权威（拿到 IP）
②建连    ：TCP 三次握手；HTTPS 再 TLS 握手（1.3 一 RTT/0-RTT）
③请求    ：HTTP 报文逐跳转发（ARP 找网关 MAC、路由表选下一跳、NAT 穿出）
④服务端  ：LB 分发→网关→应用逻辑→缓存/DB→拼响应
⑤渲染    ：HTML 解析成 DOM、CSS 成 CSSOM→合成渲染树→布局（几何）→绘制（像素）
          →遇到 script 阻塞/异步、遇到子资源（图片/CSS）递归拉取
```

**提速的抓手就藏在各步里**：①**DNS 预取/HTTPDNS**；②**连接复用**（keep-alive/HTTP2 多路复用/QUIC 0-RTT）；③**CDN 就近**；④缓存与异步；⑤**关键渲染路径优化**（CSS 放头 JS 放尾/defer、首屏 SSR）。

答这道题的姿势：**先报主干五步，再挑两步深入**（比如 DNS 与建连）——它考的是你能不能把离散知识点串成链路。

**术语速查**：逐跳=每一站查表转交|渲染树=可见内容的合成|关键路径=首屏前的最长链

<!--advanced-->
 preload/preconnect/resource hint 的分层加速。服务端视角的同一问题（LB→网关→服务网格 sidecar 的现代路径）。QUIC 把②③的握手折叠（建连+加密一次过）。
