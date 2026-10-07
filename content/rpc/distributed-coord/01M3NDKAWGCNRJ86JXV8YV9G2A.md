---
id: 01M3NDKAWGCNRJ86JXV8YV9G2A
blockId: rpc/distributed-coord
relatedBlocks: []
question: 配置中心的核心设计？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 配置变更是推还是拉？
keyPoints:
  - id: kp-dc4-1
    text: 集中存储+版本化（谁在何时改了什么可回滚）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGTN38NM7WTAZ6BV13
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc4-2
    text: 推拉结合：长轮询推送变更 + 客户端兜底定时全量拉
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGTN38NM7WTAZ6BV13
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc4-3
    text: 灰度发布：按 ip/集群/标签分批生效
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWG8XB86HYWEEYE5JPF
      - 01M3NDKAWGTN38NM7WTAZ6BV13
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc4-4
    text: 本地快照：配置中心全挂，客户端用最后一份缓存启动
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGTN38NM7WTAZ6BV13
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc4-5
    text: 敏感配置加密（数据库密码）+ 变更审计
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGTN38NM7WTAZ6BV13
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

**配置中心=运维的遥控器**，五要件：

1. **集中+版本化**：所有环境配置一处管；每次变更**留版本**（diff/回滚/审计——改坏了 3 秒回上一版）；
2. **推拉结合**：**长轮询**（客户端挂一个 30s 请求，变更立刻返回——准实时推送）+ **定时全量拉**兜底（推送丢了最多延迟一个周期自愈）；
3. **灰度生效**：按机器/集群/百分比分批推——一台验证再全量；
4. **本地快照**：客户端把最后配置**落盘**——配置中心全挂，应用**用快照照常启动**（配置中心不在启动关键路径）；
5. **加密+审计**：密码类加密存储，变更留痕。

**术语速查**：版本化=每次变更可回滚｜长轮询=挂着的即时推送｜快照=离线保命的最后一版

<!--advanced-->
Nacos/Apollo 的模型差（Apollo 的 namespace/发布-审批流 vs Nacos 的 dataId+group+namespace）。@RefreshScope 的刷新机制（销毁重建 Bean——配置 Bean 化注意）。配置与 K8s ConfigMap 的协同。
