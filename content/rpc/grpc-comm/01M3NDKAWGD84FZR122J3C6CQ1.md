---
id: 01M3NDKAWGD84FZR122J3C6CQ1
blockId: rpc/grpc-comm
relatedBlocks: []
question: gRPC 的四种通信模式？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - HTTP/2 给 gRPC 提供了什么？
keyPoints:
  - id: kp-gr1-1
    text: Unary 一元：一请求一响应——常规 RPC
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGM9V1HE5FX74VV5P2
      - 01M3NDKAWGVFS9XRMXX5P75QX0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-gr1-2
    text: Server streaming：一请求多响应（服务端流）——推送/大结果分批
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGM9V1HE5FX74VV5P2
      - 01M3NDKAWGQ7Z67WW8WA14FZQV
      - 01M3NDKAWGVFS9XRMXX5P75QX0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-gr1-3
    text: Client streaming：多请求一响应——批量上传/聚合
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGM9V1HE5FX74VV5P2
      - 01M3NDKAWGVFS9XRMXX5P75QX0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-gr1-4
    text: Bidirectional streaming：双向流——聊天/实时协作/IoT
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGM9V1HE5FX74VV5P2
      - 01M3NDKAWGQ7Z67WW8WA14FZQV
      - 01M3NDKAWGVFS9XRMXX5P75QX0
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
misconceptions:
  - id: mc-gr1-1
    text: "多路复用让 gRPC 彻底告别队头阻塞，一个调用丢包不影响同连接的其他调用"
    why: "误解：多路复用只消除了应用层的按序排队——TCP 丢包重传时整条连接的全部流都得停着候，传输层的队头阻塞仍在"
  - id: mc-gr1-2
    text: "gRPC 的每次调用独占一条 HTTP/2 连接，调用完就释放"
    why: "误解：连接是长驻复用的——并发调用以流为单位共享同一条连接，调用结束关的是流不是连接"
  - id: mc-gr1-3
    text: "一元调用没有流，四种模式里只有双向流才用到 stream"
    why: "误解：gRPC 在 HTTP/2 上一切调用皆流——一元也是一条恰好只含一条消息的流，四种模式只是每个方向的消息条数不同"
---

四种**流形态**（按数据往哪个方向流）：

- **Unary**：一来一回——最普通（调接口）；
- **服务端流**：一次请求，服务端**连发多条**（逐条 push）——推送行情/大结果分批下载；
- **客户端流**：客户端**连发**，服务端收完回一个总结——批量上传/聚合统计；
- **双向流**：两边都能随时发——实时聊天/双向心跳的 IoT。

底座是 **HTTP/2** 的三个能力：**多路复用**（一条 TCP 上并发多个调用不互相阻塞——解决 HTTP/1.1 的队头阻塞）、**流（stream）**原生支持（双向帧序列）、**头部压缩 HPACK**（重复头字段压掉）。内容编码统一 **Protobuf**（强类型小体积）。

**术语速查**：一元=一来一回｜服务端流=一发多收｜多路复用=一条连接跑多个并发调用

<!--advanced-->
stream 的背压（flow control window——收方控制发速）。grpc 的 deadline/cancellation（取消沿调用链传播）。keepalive 与长连接的负载不均（客户端级连接 vs 请求级负载均衡——LRS/代理的解）。
