---
id: 01M3NDKAWGTN38NM7WTAZ6BV13
blockId: rpc/distributed-coord
relatedBlocks:
  []
question: "ZooKeeper 和 Nacos 怎么选？"
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 注册中心为什么常选 AP？
keyPoints:
  - id: kp-dc1-1
    text: "ZK：CP 型（ZAB 一致性优先）——选主/分布式锁/强一致元数据"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-dc1-2
    text: "Nacos：AP/CP 可切（Raft/Distro 双模式）——注册中心+配置中心二合一"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-dc1-3
    text: "注册中心场景 AP 通常更优：可用性>强一致（宁要旧地址不要全体瘫痪）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-dc1-4
    text: "Nacos 支持健康检查/权重/推送；ZK 的 Watch 一次性需重注册"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
---

按**CAP 取舍**分两派：

- **ZooKeeper（CP）**：写走 ZAB 过半协议——**一致性优先**：分区时少数派不可用。强项：**选主/分布式锁/配置强一致**（Kafka HDFS K8s 早期的底座）。短处：**注册中心场景反而危险**——网络抖动时大面积节点被判死不可服务（其实活着）；
- **Nacos（AP/CP 可切）**：**临时实例走 Distro（AP）**——分区时各自可读写（可用性优先，接受短暂不一致）；持久实例走 Raft（CP）。附加**推送变更**与**配置中心**能力（生态二合一）。

**注册中心选 AP 的逻辑**：地址列表**旧一点没关系**（客户端有缓存+重试），**全瘫才是灾难**——可用性压倒一致性。反过来**选主/锁**必须 CP（两个主是更深的灾难）。

**术语速查**：CP=宁停不错｜AP=宁旧不停｜选主=必须唯一的场景

<!--advanced-->
ZK 的 session/临时节点与 Watch 语义（一次性触发+重连重.watch）。Distro 的最终一致（异步同步+本地写优先）。Eureka 的纯 AP 自我保护（极端可用性派）。K8s etcd=Raft CP。
