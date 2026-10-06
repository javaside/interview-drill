---
id: 01M3NE18CMMN85TJVBTEV2E8WA
blockId: distributed/dist-tx
relatedBlocks: []
question: TCC 模式怎么工作？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 空回滚和悬挂是什么？
keyPoints:
  - id: kp-dt2-1
    text: Try：预留资源（冻结 100 元而非真扣）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt2-2
    text: Confirm：确认扣减（冻结转真扣）——必须成功（重试到成功）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt2-3
    text: Cancel：取消预留（解冻）——同样必须成功
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt2-4
    text: 三方法皆需 idempotent 与防悬挂（Cancel 先到 Try 后到）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-dt2-5
    text: 对比 2PC：锁变成业务级冻结——性能好但要写三套逻辑
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

**TCC（Try-Confirm-Cancel）**=把 2PC 的「数据库锁」换成「**业务级预留**」：

```
Try    ：检查+预留——冻结 100 元（账户余额 500 → 可用 400 + 冻结 100）
Confirm：确认——冻结 100 转真扣（实际业务落地）
Cancel ：取消——解冻 100（可用恢复 500）
```

性能远好于 2PC（不持数据库锁，冻结就是一行记录），代价是**每个参与方写三个方法**且必须处理两个妖怪：

- **空回滚**：Try 的请求**没到**（网络丢），Cancel 先到了——没预留却要取消 → Cancel 查无此事务 → **记一个「已回滚」标记直接返回成功**；
- **悬挂**：Cancel 执行完后，**迟到的 Try 才到达**——再预留就没人来取消了（资源永久冻结）→ Try 先查「已回滚」标记，有则**拒绝执行**。

两个妖怪的统一解：**事务状态表**（Try 前插记录，Cancel/Confirm 按状态机走）。

**术语速查**：冻结=业务级软锁｜空回滚=没试就要撤｜悬挂=撤完了又来试

<!--advanced-->
Confirm/Cancel 的重试必须 idempotent（框架定时轮询失败记录）。并发控制（Try 的可用额度检查用乐观锁）。seata TCC 模式与蚂蚁 SOFATCC 的防悬挂实践。
