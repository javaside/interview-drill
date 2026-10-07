---
id: 01M3NE18CNRE3T5V7X9Z1C3
blockId: network/tcp-troubles
relatedBlocks: []
question: TCP keepalive 和应用层心跳怎么选？
cardType: comparison
appliesTo: 通用
frequency: high
followUps:
  - 为什么 2 小时的默认探测等于没有？
  - 心跳间隔怎么定？
keyPoints:
  - id: kp-tt3-1
    text: TCP keepalive：内核发的探测空包——默认 2 小时才起探
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNRG7X9Z1C3E5G7
      - 01M3NE18CNRZ7M7Q9T1V3
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: RFC 9293
  - id: kp-tt3-2
    text: 应用心跳：业务自发的 ping/pong——间隔语义自己定
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNRZ7M7Q9T1V3
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: RFC 9293
  - id: kp-tt3-3
    text: 共同目的：探活对端是否还在，及时回收死连接资源
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNRZ7M7Q9T1V3
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: RFC 9293
  - id: kp-tt3-4
    text: 心跳优先：可控间隔、跨中间盒可靠（LB/防火墙会清空闲流表）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNRZ7M7Q9T1V3
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: RFC 9293
  - id: kp-tt3-5
    text: 心跳顺带承担连接可用性预热与 RTT 测量的副业
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: RFC 9293
---

两类探活都在回答「**对面还活着吗**」——不探的后果是**半开连接**（对端断电/拔网线，你这头永远不知道，连接与内存白占）：

| 维度 | TCP keepalive | 应用层心跳 |
|---|---|---|
| 发起者 | 内核协议栈 | 业务代码（ping/pong） |
| 默认间隔 | **7200 秒**才首探（tcp_keepalive_time） | 自己定（常见 15–60s） |
| 中间盒友好 | 同样要过 NAT/LB 清表 | **顺带刷新中间盒流表**防被清 |
| 语义 | 只证明 TCP 栈活着（进程死了内核还能代答！） | **证明业务进程能响应** |
| 穿代理 | 若干代理不透传 | 应用层报文**天然穿透** |

工程结论：**心跳为准**——LB/NAT 的空闲超时（常见 5–15 分钟）会悄悄清掉流表，客户端再发包就石沉大海；应用心跳间隔要**小于链路上最短的空闲超时**（经验：其 1/3）。进程假死（栈活着逻辑卡死）也只有业务心跳能暴露。

**术语速查**：半开连接=对面没了你不知道|流表=NAT/LB 的记账本|心跳=业务级探活+续租

<!--advanced-->
心跳的 timeout 判定（连续 N 次失联才断，防单次抖动误杀）。gRPC 的 keepalive 参数与 HTTP/2 PING 帧（协议内建心跳）。MQ 客户端的心跳与重连风暴（雪崩时心跳洪泛——抖动退避）。
