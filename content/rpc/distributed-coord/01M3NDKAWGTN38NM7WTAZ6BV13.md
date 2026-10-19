---
id: 01M3NDKAWGTN38NM7WTAZ6BV13
blockId: rpc/distributed-coord
relatedBlocks: []
question: ZooKeeper 和 Nacos 怎么选？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 注册中心为什么常选 AP？
keyPoints:
  - id: kp-dc1-1
    text: ZK：CP 型（ZAB 一致性优先）——选主/分布式锁/强一致元数据
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWG02XR7GZ4F436Z7BM
      - 01M3NDKAWGH3ZAN5C4S100CG20
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc1-2
    text: Nacos：AP/CP 可切（Raft/Distro 双模式）——注册中心+配置中心二合一
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWG02XR7GZ4F436Z7BM
      - 01M3NDKAWGCNRJ86JXV8YV9G2A
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc1-3
    text: 注册中心场景 AP 通常更优：可用性>强一致（宁要旧地址不要全体瘫痪）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWG02XR7GZ4F436Z7BM
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc1-4
    text: Nacos 支持健康检查/权重/推送；ZK 的 Watch 一次性需重注册
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
misconceptions:
  - id: mc-dc1-1
    text: "ZooKeeper 是 AP 系统，网络分区时两边都能继续对外服务"
    why: "误解：ZK 写走 ZAB 过半提交，分区时凑不够过半的一侧直接不可用——它是把一致性排在可用性前面的 CP"
  - id: mc-dc1-2
    text: "Eureka 与 Nacos 一样能切换 CP 模式应对分区"
    why: "误解：Eureka 是纯 AP 的极端可用派——自我保护机制宁可保留过期实例也不剔除，从不提供过半强一致模式"
  - id: mc-dc1-3
    text: "ZK 客户端注册一次 Watch 就能一直收到节点变更通知"
    why: "误解：ZK 的 Watch 是一次性的——触发即失效，想继续盯就得在回调里重新注册，漏注册就再也收不到后续变更"
---

按**CAP 取舍**分两派：

- **ZooKeeper（CP）**：写走 ZAB 过半协议——**一致性优先**：分区时少数派不可用。强项：**选主/分布式锁/配置强一致**（Kafka HDFS K8s 早期的底座）。短处：**注册中心场景反而危险**——网络抖动时大面积节点被判死不可服务（其实活着）；
- **Nacos（AP/CP 可切）**：**临时实例走 Distro（AP）**——分区时各自可读写（可用性优先，接受短暂不一致）；持久实例走 Raft（CP）。附加**推送变更**与**配置中心**能力（生态二合一）。

**注册中心选 AP 的逻辑**：地址列表**旧一点没关系**（客户端有缓存+重试），**全瘫才是灾难**——可用性压倒一致性。反过来**选主/锁**必须 CP（两个主是更深的灾难）。

**术语速查**：CP=宁停不错｜AP=宁旧不停｜选主=必须唯一的场景

<!--advanced-->
ZK 的 session/临时节点与 Watch 语义（一次性触发+重连重.watch）。Distro 的最终一致（异步同步+本地写优先）。Eureka 的纯 AP 自我保护（极端可用性派）。K8s etcd=Raft CP。
