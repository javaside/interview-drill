---
id: 01M3NDKAWGNKY2WFP765VFVZ3X
blockId: rpc/service-governance
relatedBlocks: []
question: 链路追踪的原理？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - traceId 怎么跨线程传递？
keyPoints:
  - id: kp-sg4-1
    text: TraceId 全链路唯一：一次请求经过所有服务共用一个 ID
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-sg4-2
    text: SpanId/ParentSpanId 记录调用层级（谁调的谁）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-sg4-3
    text: 埋点数据异步上报（不打扰业务），聚合还原成调用树
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-sg4-5x
    text: 上下文跨进程传播：HTTP 头/MQ 消息头（W3C traceparent）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-sg4-5
    text: 价值：慢在哪一环、错在哪一层、一次请求的完整路径
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNTM3E5G7K9S1V3X5
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
misconceptions:
  - id: mc-sg4-1
    text: "TraceContext 放进 ThreadLocal，提交给线程池的异步任务就能自动带上"
    why: "误解：池化线程不随任务走，ThreadLocal 里存的东西传不过去——提交任务时要抓取上下文把 Runnable 包一层，或改用可传递的 TransmittableThreadLocal"
  - id: mc-sg4-2
    text: "每个服务的日志都打印同一个 traceId，就算完成链路追踪接入"
    why: "误解：光有 ID 拼不出调用树——span 的起止与父子层级才是还原路径的骨架，日志带上 traceId 只是排查时的顺带收益"
---

**链路追踪=给每次请求发一张全程通用的工牌**：

- **TraceId**：一次外部请求的**全局唯一 ID**——跨服务/跨 MQ 传递（藏在 HTTP 头 `traceparent`/MQ 消息属性里），谁处理都带着；
- **Span**：一段工作单元（一次 RPC/一次 DB 查询）——记耗时+结果；**ParentId** 串成树（网关→订单→库存→DB 的父子链）；
- 各服务埋点（Java Agent 字节码注入/SDK 显式 span）→ **异步上报**（本地缓冲批量发，别为观测拖慢业务）→ 收集端（Zipkin/Jaeger/SkyWalking）**拼树展示**。

**跨线程**：TraceContext 存 **ThreadLocal**——换线程池会丢！解法：**装饰 Runnable/Callable**（提交任务时抓当前 context 包装）——或用阿里 **TransmittableThreadLocal**（见并发 ThreadLocal 块）——**跨进程**同理：HTTP 头/MQ header 显式携带。

**术语速查**：工牌=TraceId｜Span=一段带耗时的工作｜上下文传播=工牌跨线程跨机的携带

<!--advanced-->
OpenTelemetry 的统一（trace/metrics/logs 三信号 + Collector）。采样策略（头部/尾部采样——全量贵、只留慢与错）。与 metrics/logs 的关联（traceId 串三支柱）。
