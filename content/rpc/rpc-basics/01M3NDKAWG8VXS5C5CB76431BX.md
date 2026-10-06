---
id: 01M3NDKAWG8VXS5C5CB76431BX
blockId: rpc/rpc-basics
relatedBlocks: []
question: Feign 和 Dubbo 的区别？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 中小团队选哪个？
keyPoints:
  - id: kp-rb3-1
    text: Feign：HTTP 为载体（默认配合 SpringMVC 语义），REST 风格
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb3-2
    text: Dubbo：TCP 长连接 + 自定义协议 + 二进制序列化，性能更高
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb3-3
    text: Feign 集成 Spring Cloud 生态（与注册中心/熔断丝滑）；Dubbo 自成体系治理完善
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb3-4
    text: 体感：Feign 声明式接口像写 Controller；Dubbo 像注入本地 Bean
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb3-6
    text: Feign 可换 httpclient/okhttp 底层实现
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb3-5
    text: Dubbo3 的 Triple 协议与 gRPC 生态互通
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

两条路线的**气质差异**：

| | **Feign**（HTTP/REST） | **Dubbo**（TCP RPC） |
|---|---|---|
| 载体 | HTTP 文本（JSON 居多） | TCP 长连 + 二进制 |
| 性能 | 中（HTTP 头开销+JSON 体积） | 高（协议精简+连接复用） |
| 生态 | Spring Cloud 全家桶无缝 | 自带治理全家桶（注册/路由/管控台） |
| 调试 | curl/网关直接打 | 需 telnet/专有工具 |

**中小团队**：已上 Spring Cloud → Feign（少一层概念、HTTP 生态通用、压榨性能不是主要矛盾）。**高性能内网调用**（交易/推荐数百 QPS 链路）→ Dubbo/gRPC。Dubbo 3 也支持应用级服务发现与 Triple（gRPC 兼容协议）——两条路线在融合。

**术语速查**：声明式=接口+注解即客户端｜长连接=复用免握手｜治理=发现/容错/限流的总称

<!--advanced-->
Feign 的编解码器/拦截器扩展与 fallback 降级。Dubbo 的 Provider/Consumer/Registry 三角与 Filter SPI 链。protocol=tri 的 HTTP/2 化迁移路径。
