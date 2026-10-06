---
id: 01M3NDKAWGQ7Z67WW8WA14FZQV
blockId: rpc/grpc-comm
relatedBlocks: []
question: 长连接和短连接怎么选？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: mid
followUps:
  - 为什么数据库连接池不能太大？
keyPoints:
  - id: kp-gr3-1
    text: 短连接：一次请求一次建连——简单但握手/慢启动开销大
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-gr3-2
    text: 长连接：建一次复用——省握手、低延迟，但需心跳保活与连接管理
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-gr3-3
    text: 连接池=长连接的工程化：池化复用+上限+健康检查
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-gr3-4
    text: HTTP keep-alive 即长连接复用；gRPC/Dubbo 默认长连
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-gr3-5
    text: 注意连接级负载不均：长连 + L4 LB 可能压偏（请求级均衡才均匀）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

**短连接**：每次调用都 TCP 握手（+TLS 更贵）+ 慢启动——高频调用下开销显著；**长连接**：握手一次**复用万次**（HTTP keep-alive/Dubbo/gRPC 的默认）——代价是要管：**心跳保活**（探测死链）、**连接池上限**、闲置回收。

**连接池不是越大越好**（数据库视角的经典反直觉）：连接=数据库的**进程/线程资源**（MySQL 每连接一个线程）——池 500 = DB 常驻 500 线程空转争 CPU/内存；上下文切换与锁竞争反而**拉高延迟**。经验值：`连接数 ≈ 核心数 × 2 + 有效磁盘数`（HikariCP 公式）——**几十就够**，吞吐不够加机器别加连接。

**长连接 + L4 负载均衡的坑**：负载均衡按**连接**分发——客户端 10 条长连全落在少数几台（**连接粘滞**）——要么 L7 请求级均衡、要么客户端少连多路复用。

**术语速查**：复用=一次握手多次请求｜心跳=探活死链｜连接粘滞=L4 按连分发的偏斜

<!--advanced-->
HTTP/2 单连接多路复用对 LB 的影响（一条 TCP 打满单核——单连接上限）。连接池的软上限/硬上限与获取超时排队的取舍。FIN/RST 与 half-open 连接的探活（TCP keepalive 参数 vs 应用层心跳）。
