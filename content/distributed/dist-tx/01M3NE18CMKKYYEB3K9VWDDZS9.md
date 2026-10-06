---
id: 01M3NE18CMKKYYEB3K9VWDDZS9
blockId: distributed/dist-tx
relatedBlocks: []
question: Saga 模式怎么工作？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 补偿不了怎么办？
keyPoints:
  - id: kp-dt3-1
    text: 长事务拆成本地事务链：T1→T2→T3 每步独立提交
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt3-2
    text: 失败补偿：T3 失败则逆序执行 C2、C1 抵消
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt3-3
    text: 无全局锁（对比 2PC）——吞吐高但不隔离
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt3-4
    text: 编排（中心协调）vs 协同（事件订阅）两种实现
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt3-5
    text: 补偿必须 idempotent 且可重试；不可补偿的操作不进链
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

**Saga** = 把长事务**拆成本地事务链**，失败就**逆序补偿**：

```
正向：T1 扣库存 → T2 创建订单 → T3 扣余额（本地事务各自立即提交）
T3 失败 → 补偿：C2 取消订单 → C1 恢复库存（逆序反向抵消）
```

对比 2PC：**没有全局锁**——每步提交即释放，吞吐高一个量级；代价是**没有隔离性**（中间态对外可见——别人能看见「订单已建但没付钱」的窗口）。

**补偿不了的操作不能进链**（设计红线）：发短信/发 RocketMQ 消息收不回——要么挪到链尾（最后才发），要么改成**可逆动作**（「下单成功通知」改成查表补发）。

实现两形态：**编排**（orchestration——中心状态机指挥下一步，seata saga/Temporal）与**协同**（choreography——服务监听彼此事件，去中心但链路难追踪）。

**术语速查**：本地事务链=每步独立提交｜逆序补偿=失败往回滚｜无隔离=中间态可见

<!--advanced-->
隔离性缺失的对策（语义锁：订单状态 PROCESSING 别人只能读）/业务容忍设计。补偿的「补偿失败」重试与人工兜底表。长流程的状态机持久化与恢复（Temporal durable execution 思路）。
