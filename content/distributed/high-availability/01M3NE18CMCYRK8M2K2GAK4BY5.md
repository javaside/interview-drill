---
id: 01M3NE18CMCYRK8M2K2GAK4BY5
blockId: distributed/high-availability
relatedBlocks:
  []
question: "容量规划和压测怎么做？"
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - 为什么压测要在生产环境？
keyPoints:
  - id: kp-ha5-1
    text: "容量=单机容量×数量×水位折扣——压测得出单机基准"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ha5-2
    text: "压测类型：基准（单接口）/链路（全链路压测）/浸泡（稳定性）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ha5-3
    text: "全链路压测：影子库/影子表隔离压测数据——生产环境真实流量模型"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ha5-4
    text: "容量目标：峰值×冗余系数（如 1.5 倍），瓶颈定位到具体资源"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
  - id: kp-ha5-5q
    text: "常态化：容量水位告警+弹性伸缩联动"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: 'DDIA'
---

**容量=能扛住多少流量**，规划四步：

1. **单机基准**：压测机打单实例——找到它的 QPS/RT 极限与**瓶颈资源**（CPU 80%？DB 连接？IO？）；
2. **全链路压测**：生产拓扑下打**真实流量模型**（读写比、接口占比）——为什么在**生产环境**：预发环境的配置/数据量/网络根本不代表真实（缓存命中率、DB 数据规模、连接数全不同）——**影子表**（压测流量打 `_stress` 后缀表/影子库）隔离数据副作用；
3. **容量推算**：目标峰值 × 冗余系数（一般 1.5）→ 需要多少实例 → 各依赖（DB/缓存/MQ）是否成瓶颈；
4. **常态化**：水位告警（CPU/带宽/慢查询）+ 弹性伸缩规则 + 定期复压（大促前回归）。

**术语速查**：单机基准=一台的极限｜影子表=压测数据的隔离沙箱｜冗余系数=留的余量

<!--advanced-->
压测流量的标记透传（全链路 marker 识别压测请求）。流量录制回放（tcpcopy/goreplay 真实模型）。容量应急预案：扩容速度 vs 弹性上限 vs 降级路径的演练。
