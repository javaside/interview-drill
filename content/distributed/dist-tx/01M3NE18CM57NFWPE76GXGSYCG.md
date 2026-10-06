---
id: 01M3NE18CM57NFWPE76GXGSYCG
blockId: distributed/dist-tx
relatedBlocks: []
question: 2PC 的流程和缺陷？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 3PC 修好了吗？
keyPoints:
  - id: kp-dt1-1
    text: 准备阶段：协调者问所有参与者能否提交，各自锁资源应答
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt1-2
    text: 提交阶段：全 YES 则统一提交，任一 NO 则统一回滚
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt1-3
    text: 缺陷 1 同步阻塞：准备后到提交前全员锁资源干候
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt1-4
    text: 缺陷 2 协调者单点：其二阶段决策前挂，参与者进退不得
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt1-5
    text: 缺陷 3 数据不一致：二阶段消息部分到达（网络分区）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

**两阶段提交（2PC）**=「先投票、再执行」：

```
阶段一（准备）：协调者问全员「能提交吗？」→ 参与者执行事务、锁住资源、答 YES/NO
阶段二（提交）：全 YES → 统一发 commit；有 NO → 统一 rollback
```

三个硬伤：①**同步阻塞**——准备后全员**持锁候着**协调者（期间谁也别想动这些资源）；②**协调者单点**——它在阶段二前挂了，参与者**既不敢提交也不敢回滚**（锁到天荒地老）；③**二阶段消息丢一半**——部分提交部分没提交（数据不一致）。

**3PC**（加 CanCommit 预询 + 超时自动提交）缓解阻塞与单点，但**没根治**（超时策略在分区下仍会不一致），代价是多一轮 RTT——工程上几乎没人用，直接跳到 TCC/Saga。

**术语速查**：先投票再执行=两阶段的形状｜持锁候=阻塞的根源｜单点协调者=最脆的一环

<!--advanced-->
XA 协议即 2PC 的标准实现（数据库 XA 事务，seata 的 XA 模式）。MySQL XA 的悬挂问题。2PC 的锁持有时间与吞吐的数学关系——长事务大敌。
