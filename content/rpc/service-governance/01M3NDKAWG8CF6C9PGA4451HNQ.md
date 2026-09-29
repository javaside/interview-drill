---
id: 01M3NDKAWG8CF6C9PGA4451HNQ
blockId: rpc/service-governance
relatedBlocks:
  []
question: "网关在微服务里的职责？"
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 网关和服务网格的区别？
keyPoints:
  - id: kp-sg3-1
    text: "统一入口：路由转发（外部→内部服务）、协议转换"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-sg3-2
    text: "横切面：鉴权、限流、黑白名单、日志埋点"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-sg3-3
    text: "南北向流量治理：灰度路由（按头/权重分流版本）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-sg4-4
    text: "屏蔽内部拓扑：服务扩缩容/拆分对外无感"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
  - id: kp-sg3-5
    text: "常见：Nginx/OpenResty（流量层）、Spring Cloud Gateway（业务层）、Kong/APISIX（插件化）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: 'doc'
---

**网关=微服务的城门**：所有外部流量（南北向）的**唯一入口**，职责三块：

1. **路由**：按路径/头/Host 转发到对应服务（外部只见 api.example.com，不见内部 20 个服务的拓扑——**内部怎么拆并对外无感**）；
2. **横切**：鉴权（JWT 校验）、限流（入口闸门）、黑白名单、埋点日志——**集中做一次**，各业务服务不用重复；
3. **治理**：灰度路由（Header 带 canary 的去新版本）、超时/重试兜底。

**与服务网格（Service Mesh）的区别**：网关管**南北向**（外部进来）；网格（Envoy sidecar）管**东西向**（服务之间）——把治理能力从 SDK 下沉到基础设施层，业务零侵入。

**术语速查**：南北向=进出系统的流量｜东西向=服务间流量｜灰度=按标记分流新旧版

<!--advanced-->
Gateway 的 Predicate/Filter 模型（路由断言+前置后置过滤器链）。APISIX/Kong 的插件热插拔（etcd 下发）。网关自身高可用（LVS/Anycast 前置+多活）。BFF 与网关的分层。
