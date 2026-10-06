---
id: 01M3NDKAWGA004Z8DA9CMXHVWQ
blockId: rpc/dubbo
relatedBlocks: []
question: Dubbo 的 SPI 和 Java SPI 的区别？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 为什么 Dubbo 不直接用 Java SPI？
keyPoints:
  - id: kp-du4-1
    text: 按名加载：META-INF/dubbo/ 下接口全限定名文件，key=实现名
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du4-2
    text: 自适应扩展 @Adaptive：运行时按参数选实现（protocol=xxx）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du4-3
    text: AOP/IoC 增强：扩展点可被 wrapper 包装、可注入其他扩展
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du4-4
    text: 对比 Java SPI：一次性全实例化 vs 按需单个；无自适应与依赖注入
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

**SPI=框架的插件机制**（协议/注册中心/负载均衡全是插件）。Dubbo 增强 SPI 的三板斧：

1. **按名取用**：Java SPI 是 `Iterator` **全量实例化**（用一个也要全造）；Dubbo 的 `getExtension("dubbo")` **按需单个**；
2. **@Adaptive 自适应**：运行时按 URL 参数（`?protocol=dubbo`）**动态选实现**——一行注解生成选择代码；
3. **IoC/AOP**：扩展点可注入别的扩展（依赖装配）、可被 Wrapper 包装（织入日志/监控）——**微内核+全插件**的根基（Dubbo 核心只是流程骨架，一切皆扩展）。

**术语速查**：按名加载=key 寻址插件｜自适应=参数动态路由｜微内核=核心极薄插件化一切

<!--advanced-->
ExtensionLoader 的双重检查缓存与 Holder。@Activate 的条件激活（provider 侧自动装配 filter）。Java SPI 的线程不安全迭代与 Dubbo 类加载器隔离（热部署场景）。
