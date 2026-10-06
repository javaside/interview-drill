---
id: 01M3NDKAWGNWPDP2H7CQCBZE3V
blockId: rpc/dubbo
relatedBlocks: []
question: 负载均衡策略有哪些？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 一致性哈希解决什么？
keyPoints:
  - id: kp-du3-1
    text: Random（默认）：按权重随机——大流量下天然均衡
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du3-2
    text: RoundRobin：加权轮询——均匀但无随机打散
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du3-3
    text: LeastActive：选活跃调用最少的——慢机器自动少接活
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du3-4
    text: ConsistentHash：同参数同机器——有状态路由（会话/分片亲和）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-du3-5
    text: ShortestResponseTime：响应最快优先（P99 敏感场景）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

**流量怎么分给多台 Provider**：

- **Random 加权随机**（默认）：权重比例即流量比例——**大数定律**下天然均衡，机器临时抖动不致全去别家；
- **RoundRobin 加权轮询**：绝对均匀——**长连接预热/冷启动**场景更稳（不会瞬间打满新机器）；
- **LeastActive 最少活跃**：谁的**在途请求**少给谁——**慢机器自动降权**（处理慢→积压活跃→接更少→恢复），自适应；
- **ConsistentHash 一致性哈希**：**同参数永远同机器**——有状态路由（同一用户会话亲和/缓存命中）；节点增减只迁移 1/N 的 key（对比取模全洗牌）；
- **ShortestResponseTime**：最近响应最快的优先——对尾延迟敏感。

**术语速查**：活跃数=在途请求数｜哈希亲和=同 key 同机器｜1/N 迁移=一致性哈希的扩缩容代价

<!--advanced-->
consistent hash 的虚拟节点（解决数据倾斜——每物理机映射 N 个虚点）。预热权重（warmup 新机渐进放量）。负载均衡与重试的联动（failover 换机需 bypass 当前节点）。
