---
id: 01M3NE18CMTB6TCQT0VZ7GZ1CR
blockId: distributed/dist-cache
relatedBlocks:
  []
question: "缓存和数据库的一致性怎么保证？"
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 为什么是删缓存而不是更新缓存？
keyPoints:
  - id: kp-dc7-1
    text: "主流：Cache Aside——读 miss 回源回填；写先更 DB 再删缓存"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-dc7-2
    text: "为何删不改写缓存：并发改写易乱序覆盖；删除天然 idempotent"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-dc7-3
    text: "先删缓存再更 DB：读旧值回填脏数据窗口更大"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-dc7-4
    text: "极致方案：延迟双删（更新后再删一次兜底）/ binlog 订阅异步删"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-dc7-5
    text: "接受短暂不一致（TTL 兜底）是多数业务的现实选择"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
---

**Cache Aside（旁路缓存）**——业务代码亲自管缓存的事实标准：

- **读**：先查缓存 → miss 查 DB → **回填**缓存；
- **写**：**先更新 DB，再删除缓存**。

两个经典问的答案：

1. **为什么删而不是更新缓存**：并发两个写（A 改 x=1、B 改 x=2）——若「更新缓存」，网络乱序可能 B 先到缓存变 2 再 A 到变 1（**旧值覆盖新值**）；**删除**天然幂等，下次读自然回填最新——且很多缓存值是聚合计算结果，改一处不值得重算；
2. **为什么先 DB 后删缓存**：反过来「先删后更 DB」——删后一个读 miss 查到**旧库值**回填，随后 DB 才更新——**脏数据活满 TTL**。即便先 DB 后删也有小概率不一致（读 miss 在 DB 更新前读到旧值、在删除后回填）——**TTL 兜底**或**延迟双删**（提交后延迟几百 ms 再删一次）/ **binlog 订阅**（canal 监听变更异步删——解耦且不侵入业务）。

**术语速查**：旁路缓存=业务自己管｜删除幂等=并发写不乱序｜TTL 兜底=最坏活到过期

<!--advanced-->
读写穿透（read/write through——缓存层代理读写）与写背后（write behind——异步刷库）的对比。强一致场景放弃缓存（读写锁/版本号）。facebook 的 lease 机制防读旧回填。
