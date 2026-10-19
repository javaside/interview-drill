---
id: 01M3NDKAWGX9FZ6VE7ETS22432
blockId: rpc/service-governance
relatedBlocks: []
question: 熔断、降级、限流的区别？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 三者谁保护谁？
keyPoints:
  - id: kp-sg1-1
    text: 限流：入口控制并发/速率——保自己不死（量的问题）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWG8CF6C9PGA4451HNQ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-sg1-2
    text: 熔断：下游故障率超阈值时直接断路快速失败——保自己不被拖死
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWG8CF6C9PGA4451HNQ
      - 01M3NDKAWGJ7BTBF0M6AT4TW7T
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-sg1-3
    text: 降级：有损服务——核心保住、旁路舍弃或返回兜底值
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWG8CF6C9PGA4451HNQ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-sg1-4
    text: 三者常联动：熔断触发后走降级逻辑；限流是常态防御
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWG8CF6C9PGA4451HNQ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
misconceptions:
  - id: mc-sg1-1
    text: "熔断器打开后仍以小流量持续调用下游，边试边候它恢复"
    why: "误解：打开态是立刻失败零调用——试探只发生在半开态、且只放行有限的探测请求，成功才逐步恢复流量"
  - id: mc-sg1-2
    text: "半开状态就是按一半流量放行，一半请求正常打到下游"
    why: "误解：半开只放行一两个探测请求——探测成功才切回闭合全量放行，失败立刻弹回打开态，与五五开的流量比例无关"
  - id: mc-sg1-3
    text: "限流、熔断、降级本质是同一件事，都是防过载，装一个就够"
    why: "误解：三者各守一段——限流挡超额的量、熔断斩慢下游的拖累、降级是有损保核心的预案，谁也替换不了谁"
---

**三种自保手段，保护对象不同**：

- **限流**：**入口**的闸门——请求量超过承受力就排队/拒绝（**保自己**不被打死）。算法：令牌桶/漏桶/滑动窗口；
- **熔断**：**出口**的空气开关——发现某下游**持续失败**（错误率/慢调用超阈值），直接**断路**：一段时间内不再调用、立刻失败（**保自己**不被慢下游拖死线程）；半开试探恢复；
- **降级**：**有损预案**——忙不过来/下游挂时，主动放弃旁路（不显示推荐/评论），返回兜底（缓存/默认值/友好提示）——**保核心**弃枝节。

联动剧本：大促流量洪峰→限流挡住超额→推荐服务变慢触发熔断→页面走降级（不展示推荐栏）——核心下单链路全程无感。

**术语速查**：入口闸=限流｜出口闸=熔断｜弃车保帅=降级

<!--advanced-->
Sentinel 的滑动窗口与流控效果（Warm Up/排队候行）。熔断器三态机（closed/open/half-open 的转换条件）。降级的层次（接口级/功能级/页面级）与预案演练。
