---
id: 01M3NDKAWGD84FZR122J3C6CQ1
blockId: rpc/grpc-comm
relatedBlocks:
  []
question: "gRPC 的四种通信模式？"
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - HTTP/2 给 gRPC 提供了什么？
keyPoints:
  - id: kp-gr1-1
    text: "Unary 一元：一请求一响应——常规 RPC"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-gr1-2
    text: "Server streaming：一请求多响应（服务端流）——推送/大结果分批"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-gr1-3
    text: "Client streaming：多请求一响应——批量上传/聚合"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-gr1-4
    text: "Bidirectional streaming：双向流——聊天/实时协作/IoT"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
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
