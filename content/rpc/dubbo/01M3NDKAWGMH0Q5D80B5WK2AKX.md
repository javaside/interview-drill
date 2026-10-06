---
id: 01M3NDKAWGMH0Q5D80B5WK2AKX
blockId: rpc/dubbo
relatedBlocks: []
question: Dubbo 的整体架构角色？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 注册中心挂了服务还能调吗？
keyPoints:
  - id: kp-du1-1
    text: Provider 注册服务到 Registry；Consumer 订阅并缓存地址列表
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du1-2
    text: Registry 只通知变更（推送一次，之后增量），宕机不影响已运行调用
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du1-3
    text: Monitor 统计调用；Container 承载 Provider 运行
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du1-4
    text: 调用直连 Consumer→Provider（注册中心不在调用链上——去中心化运行时）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

**Dubbo 五角色**（Provider/Consumer/Registry/Monitor/Container）的**关键设计**：

- **启动时**：Provider 向 **Registry** 注册地址；Consumer 订阅——拿到地址列表后**本地缓存**；
- **运行时**：调用是 **Consumer 直连 Provider**——**注册中心不在调用链上**！Registry 挂了：已缓存的地址照常调（只是新上下线感知不到）——**运行时去中心化**，注册中心只需保证最终一致的变更通知；
- **Monitor**：异步上报调用统计（旁路，不阻塞调用）。

**术语速查**：订阅推送=变更才通知｜本地缓存=地址列表的离线保命｜直连=调用不经注册中心

<!--advanced-->
接口级 vs 应用级服务发现（Dubbo3 的应用级：减少注册数据量对齐业界）。Nacos/ZK/Redis 做注册中心的差异（健康检查 CP/AP 取舍）。通知风暴与推送合并。
