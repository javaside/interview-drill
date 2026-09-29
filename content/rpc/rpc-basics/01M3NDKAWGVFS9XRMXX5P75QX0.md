---
id: 01M3NDKAWGVFS9XRMXX5P75QX0
blockId: rpc/rpc-basics
relatedBlocks:
  []
question: "零值结构与 gRPC 的四个特征不能有默认参数？"
cardType: atomic
appliesTo: Dubbo 3 / gRPC
frequency: low
followUps:
  - RPC 接口设计还有哪些约束？
keyPoints:
  - id: kp-rb4-1
    text: "默认参数是编译期语法糖：字节流层面无法表达，远端无从得知"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
---

本地方法调用的很多「便利」在**跨进程**时失效：

- **默认参数**：编译期糖——远端不知道你的默认值约定，**参数必须显式**；
- 同理：**重载**（远端只能按「方法名+参数签名」路由，重载名同签名不同在注册中心易混淆——Dubbo 直接不建议）、**可变参数**、**传 lambda/回调**（行为无法序列化——回调得换成本地注册+远端事件通知）。

**RPC 接口设计三原则**：参数对象化（DTO 显式字段，演进靠加字段）、方法粒度粗（一次网络往返别太碎）、异常显式传输（错误码字段而非依赖异常类——对端可能没有这个类）。

**术语速查**：编译期糖=字节码里不存在的便利｜DTO=为传输而生的显式结构｜错误码=跨语言的失败语义

<!--advanced-->
Schema 演进的兼容方向（提供方加字段/消费方容忍未知字段）。IDL（interface definition language）先行的契约协作（proto/thrift/idl 进仓管版本）。副作用边界：幂等接口设计（重试安全）。
