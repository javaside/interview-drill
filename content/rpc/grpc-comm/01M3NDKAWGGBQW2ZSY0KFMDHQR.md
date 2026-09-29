---
id: 01M3NDKAWGGBQW2ZSY0KFMDHQR
blockId: rpc/grpc-comm
relatedBlocks:
  []
question: "API 版本管理怎么做？"
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: mid
followUps:
  - 为什么不建议 URI 里放版本号以外还改路径结构？
keyPoints:
  - id: kp-gr5-1
    text: "URL 路径版本 /v1/——直观、可路由、最常用"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-gr5-2
    text: "Header 版本（Accept-Version）——URL 干净但不可见难调试"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-gr5-3
    text: "兼容演进优先：只加字段不删不改语义——尽量不升版本"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-gr5-4
    text: "废弃流程：标记 deprecated→公告期→双版本并存→下线旧版"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-gr5-5
    text: "gRPC/IDL 走 proto 包名版本（api.v2.OrderService）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
---

**版本=兼容性承诺的边界**。三种放法：

- **URL 路径**（`/v1/orders`——最常用）：直观可见、网关好路由、缓存友好；代价是 URL 空间膨胀；
- **Header**（`Accept: application/vnd.x+v2`）：URL 洁净——但「看不见调不了」、网关日志难审计；
- **proto 包名版本**（`api.v2.OrderService`）：gRPC 的惯例——**新版本=新服务定义**，两端各自编译迁移。

**第一原则是「能不升就不升」**：**只加字段、不改已有字段语义、不删字段**（Tolerant Reader）——大版本是最后手段。升级节奏：`v2 上线 → v1 标记 deprecated → 公告+监控 v1 流量归零 → 下线`——每一步可回退。

**术语速查**：兼容演进=加字段不破坏｜deprecated=软下线的过渡标记｜双跑期=新旧并存观察

<!--advanced-->
semantic versioning 对 API 的映射（major=破坏性）。GraphQL 的无版本演进（schema 迭代+字段废弃指令）。API 网关按版本路由的灰度组合。
