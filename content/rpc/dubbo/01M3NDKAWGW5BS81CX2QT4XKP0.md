---
id: 01M3NDKAWGW5BS81CX2QT4XKP0
blockId: rpc/dubbo
relatedBlocks: []
question: Dubbo 的集群容错模式有哪些？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 写接口为什么别用默认容错？
keyPoints:
  - id: kp-du2-1
    text: Failover（默认）：失败换一台重试——只读操作的默认
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGJ7BTBF0M6AT4TW7T
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du2-2
    text: Failfast：一次失败立即报错——写操作且未做防重时用它
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGJ7BTBF0M6AT4TW7T
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du2-3
    text: Failsafe：失败忽略只记日志——写审计日志这类可丢场景
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGJ7BTBF0M6AT4TW7T
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du2-4
    text: Failback：失败记录后台异步重发——消息通知类最终一致
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGJ7BTBF0M6AT4TW7T
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du2-5
    text: Forking/并行调用多台取最快；Broadcast 广播任意失败即失败
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

**集群容错=调用失败后的补救策略**（按业务语义选）：

- **Failover 失败转移**（默认）：失败→**换一台**重试（retries=2）——**只读**安全；**写操作用它是灾难**：第一次其实执行成功只是响应超时→换机重试→**重复执行**（非幂等写直接事故）；
- **Failfast 快速失败**：一次不行立刻报——**非幂等写**的正确选择（错误交给上层人工/事务层处理）；
- **Failsafe 安全失败**：异常吞掉记日志——**允许丢**的旁路（审计日志、 metrics 上报）；
- **Failback 失败自动恢复**：失败进队列**异步重发**——通知类（最终一致可接受延迟）；
- **Forking/broadcast**：并行取最快/广播全调——特殊场景。

**术语速查**：换机重试=Failover｜快速失败=Failfast｜异步补发=Failback

<!--advanced-->
retries 与幂等的组合律（读 2、幂等写 1、非幂等写 0）。集群的 Directory/Router/LoadBalance 三组件的调用链位置（Router 先过滤再负载均衡）。Mock=强制降级兜底。
