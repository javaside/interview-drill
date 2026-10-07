---
id: 01M3NDKAWGM9V1HE5FX74VV5P2
blockId: rpc/grpc-comm
relatedBlocks: []
question: REST 和 gRPC 怎么选？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 为什么对外接口不推荐 gRPC？
keyPoints:
  - id: kp-gr2-1
    text: 对外/开放 API：REST（HTTP 生态、调试友好、浏览器直连）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWG8VXS5C5CB76431BX
      - 01M3NE18CNS4C6E8G0K2M4N6Q8S
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-gr2-2
    text: 内部高性能服务间：gRPC（protobuf+HTTP2 多路复用）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWG13FFN5PTSDHRV6Y3
      - 01M3NE18CNS4C6E8G0K2M4N6Q8S
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-gr2-3
    text: 流式/双向实时：gRPC 四种流天然支持
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGQ7Z67WW8WA14FZQV
      - 01M3NDKAWGVFS9XRMXX5P75QX0
      - 01M3NE18CNS4C6E8G0K2M4N6Q8S
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-gr2-4
    text: 浏览器直连 gRPC 需要 grpc-web 转换层（HTTP/2 限制）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNS4C6E8G0K2M4N6Q8S
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

按**给谁用**选：

| 场景 | 选 | 理由 |
|---|---|---|
| **对外/开放平台** | REST/JSON | 全世界都会调、curl 即测、网关/CDN/监控全兼容 |
| **内部微服务间** | gRPC | 高吞吐低延迟；**契约先行**（proto 编译期查错）；四种流覆盖推送场景 |
| 浏览器前端 | REST/grpc-web | 浏览器**不能任意用 HTTP/2**——原生 gRPC 走不通，需 grpc-web + 代理转换 |
| 跨语言团队 | gRPC | proto 生成各语言客户端，契约即文档 |

一句话：**性能边界内优先 REST 生态，性能吃紧/流式/契约强诉求上 gRPC**——不少公司是「外 REST 内 gRPC」的混合。

**术语速查**：契约先行=proto 编译期校验｜外 REST 内 gRPC=最常见的混合策略

<!--advanced-->
grpc-gateway/Envoy 的 JSON↔gRPC 协议转换（一份 proto 两副面孔）。deadline 传播与服务雪崩的联动。连接与 LB：客户端长连绕过 L4 LB 的讨论（代理模式 vs 无代理的 xDS/LRS）。
