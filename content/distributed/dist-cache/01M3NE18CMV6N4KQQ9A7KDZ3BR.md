---
id: 01M3NE18CMV6N4KQQ9A7KDZ3BR
blockId: distributed/dist-cache
relatedBlocks: []
question: 缓存穿透、击穿、雪崩的区别？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 三者一句话区分？
keyPoints:
  - id: kp-dc6-1
    text: 穿透：查不存在的 key——请求打到 DB（恶意伪造 id）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dc6-2
    text: 击穿：热点 key 过期瞬间——万计并发同时砸 DB
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dc6-3
    text: 雪崩：大批 key 同时过期或缓存整体宕机——DB 被冲垮
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dc6-4
    text: 穿透防：布隆过滤器/空值缓存（短 TTL）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dc6-5
    text: 击穿防：互斥重建（只放一个请求去查库）；雪崩防：过期加随机+集群高可用
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

**三个「缓存失效伤及 DB」的病**，病因各不同：

| 病 | 病因 | 药 |
|---|---|---|
| **穿透** | 查**根本不存在**的数据（id=-1 恶意打）——缓存永远没有，回回打库 | **布隆过滤器**（先判不存在直接拒）/ **缓存空值**（短 TTL 占位） |
| **击穿** | **一个热点 key** 过期的瞬间，万计并发同时去查库重建 | **互斥锁重建**（只放一个请求去查库，其余候结果）/ 热点永不过期+异步更新 |
| **雪崩** | **大批 key 同时过期**或**缓存集群宕机**——整体流量砸穿 DB | 过期时间**加随机值**（打散）/ 缓存**集群高可用**/ 限流降级兜底 |

一句话：穿透是「**没有的也查**」、击穿是「**一个倒下**」、雪崩是「**成片倒下**」。

**术语速查**：布隆=判不存在的概率筛｜互斥重建=一次查库众人候｜随机 TTL=过期时间打散

<!--advanced-->
布隆的误判率与位数组公式（1% 误判约 9.6bit/key）；计数布隆可删。击穿的单飞（singleflight）实现。雪崩的多级缓存（本地+redis）与 request coalescing。
