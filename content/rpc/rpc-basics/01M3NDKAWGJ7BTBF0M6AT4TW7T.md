---
id: 01M3NDKAWGJ7BTBF0M6AT4TW7T
blockId: rpc/rpc-basics
relatedBlocks: []
question: 超时和重试怎么配才安全？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 为什么重试可能把系统重死？
keyPoints:
  - id: kp-rb5-1
    text: 超时必有：默认无超时=故障时线程堆积雪崩
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb5-2
    text: 重试前提：下游可防重（写操作乱重试会重复下单）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb5-3
    text: 重试预算：次数限（1-2 次）+ 退避（指数）+ 总时长上限
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb5-4
    text: 层级传递：上游超时 > 下游超时之和，避免下游已放弃上游还傻候
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb5-5
    text: 熔断接管：重试加剧过载时退场，让熔断器断路保护
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

**超时与重试是 RPC 的安全气囊，装错了会杀人**：

1. **超时必设**：无超时的调用在下游卡死时把**调用方线程池拖干**（每个挂着的请求占一个线程）——雪崩的起点。经验值：P99 耗时 × 2~3；
2. **重试的前提是幂等**：GET 天然可重；**写操作**乱重试=重复支付/重复下单——写场景要么接口幂等（幂等键），要么不自动重试；
3. **重试要预算**：次数 1-2 次 + **指数退避**（50ms/100ms/200ms）+ 总时长上限——否则故障时的重试风暴是**自己 DDoS 自己**（原本 1 倍流量放大成 3 倍，把奄奄一息的下游彻底打死）；
4. **熔断接管**：失败率飙升时重试必须让位——熔断器打开，快速失败保住两边。

**术语速查**：P99×3=超时经验公式｜重试风暴=放大流量的自残｜退避=越失败歇越久

<!--advanced-->
hedged request（对冲请求：超时前发一份到另一实例竞速）。retry budget（按错误率动态调整重试比例——envoy 的做法）。trace 里的 retry 标记与排查（重试掩盖的慢性病）。
