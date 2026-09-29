---
id: 01M3NDKAWGC9VDW0V9JSN5JFP9
blockId: rpc/dubbo
relatedBlocks:
  []
question: "服务注册与发现的完整流程？"
cardType: sequence
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 服务优雅上下线怎么做？
keyPoints:
  - id: kp-du5-1
    text: "第 1 步 Provider 启动：暴露服务端口，向注册中心注册（服务名→ip:port+元数据）"
    public: true
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-du5-2
    text: "第 2 步 Consumer 启动：订阅服务名，拉全量+接收后续变更推送"
    public: true
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-du5-3
    text: "第 3 步 本地缓存地址列表，直连调用（注册中心退出链路）"
    public: true
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-du5-4
    text: "第 4 步 变更感知：Provider 宕机/下线 → 注册中心剔除 → 推送 Consumer 刷新"
    public: true
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-du5-5
    text: "第 5 步 健康检查：心跳/租约失联判定死节点（主动剔除或过期标记）"
    public: true
    order: 5
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
---

**注册发现的五拍**（按序排）：

```
①Provider 注册 → ②Consumer 订阅（全量+增量推送）→ ③直连调用（缓存地址）
④变更推送（上下线实时刷新本地列表）→ ⑤健康检查（心跳失联剔除）
```

**优雅上下线**（发布不抖动的关键）：

- **下线**：先从注册中心**注销**→候消费者刷新缓存（sleep/确认）→**拒绝新请求**（或发 draining 标记）→**处理完存量**→关进程（kill -15 而非 -9）；
- **上线**：注册后**预热**（负载均衡给新实例低权重渐进放量；JIT/缓存/连接池热身）——避免冷实例被打挂。

**术语速查**：增量推送=只发变化部分｜心跳租约=活着的凭证｜预热=新机渐进放量

<!--advanced-->
Nacos 的临时实例（客户端心跳 5s/不健康 15s/剔除 30s）与持久实例（服务端探测）。推拉结合（UDP 推+定期全量拉兜底）。优雅停机与 K8s preStop+readinessProbe 的配合。
