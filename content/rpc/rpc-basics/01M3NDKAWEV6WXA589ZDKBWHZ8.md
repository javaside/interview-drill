---
id: 01M3NDKAWEV6WXA589ZDKBWHZ8
blockId: rpc/rpc-basics
relatedBlocks:
  []
question: "一次 RPC 调用的完整过程？"
cardType: sequence
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - stub 到底是什么？
keyPoints:
  - id: kp-rb1-1
    text: "客户端调本地代理（stub）：像调本地方法一样发起"
    public: true
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-rb1-2
    text: "序列化：方法名+参数编码成字节流"
    public: true
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-rb1-3
    text: "网络传输：字节流发往服务端"
    public: true
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-rb1-4
    text: "服务端反序列化并反射调用真实方法"
    public: true
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-rb1-5
    text: "结果原路序列化返回，代理还原给调用方"
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

**RPC（远程过程调用）的目标**：让「调另一台机器上的方法」**写起来像调本地方法**。五步流水（按序排）：

```
client.method(x)
  ①代理(stub)拦截 → ②序列化(方法+参数→字节)
  → ③网络发送 → 服务端 ④反序列化+反射调用真实实现
  → 结果原路 ⑤序列化回传 → 代理还原成返回值
```

**代理（stub）**就是那层「障眼法」：客户端拿到的不是真实对象，是**动态代理**——它假装本地方法，实际干「编码+网络」的活。Dubbo/gRPC/Feign 全是这个骨架，差别在序列化协议与传输层。

**术语速查**：stub=远程方法的本地替身｜序列化=对象变字节｜反射调用=按名字找到真方法执行

<!--advanced-->
代理层的附加职责：负载均衡选址、超时重试、熔断、连接池管理（这些就是「服务治理」插桩的层）。序列化协议的热点（hessian2/protobuf/kryo 与 JSON 的体积对比）。I/O 线程模型（Reactor 的 dubbo/gRPC netty 栈）。
