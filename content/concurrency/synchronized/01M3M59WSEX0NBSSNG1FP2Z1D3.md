---
id: 01M3M59WSEX0NBSSNG1FP2Z1D3
blockId: concurrency/synchronized
relatedBlocks: []
question: 什么是锁升级（偏向→轻量→重量）？
cardType: sequence
appliesTo: Java 17+
frequency: high
followUps:
  - 偏向锁在 JDK 15 后为什么被废弃？
keyPoints:
  - id: kp-sy2-1
    text: 第 1 态 无锁：对象刚创建，谁都没碰
    public: false
    order: 1
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy2-2
    text: 第 2 态 偏向锁：只有一个线程反复进出，Mark Word 记下它的 id（近乎零成本）
    public: false
    order: 2
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy2-3
    text: 第 3 态 轻量级锁：第二个线程来竞争，栈里建 Lock Record 做 CAS 自旋
    public: false
    order: 3
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSF16SCYSM5EVS1C59W
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy2-4
    text: 第 4 态 重量级锁：自旋失败/竞争加剧，膨胀为 ObjectMonitor（内核互斥量，阻塞排队）
    public: false
    order: 4
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSF16SCYSM5EVS1C59W
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-sy2-5
    text: 升级单向不可降（整体趋势），由 JVM 自适应完成
    public: false
    order: 5
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSF16SCYSM5EVS1C59W
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

JVM 给 synchronized 的**省钱阶梯**——按竞争烈度逐级加码（把下面的状态按升级顺序排）：

无锁 → **偏向锁** → **轻量级锁** → **重量级锁**。

- **偏向**：整条路只有你一个人走 → 门上写你的名字（Mark Word 记线程 id），进出只查名字，几乎免费；
- **轻量**：来了第二个人 → 改成**抢答**（CAS 自旋），短暂比划就分胜负；
- **重量**：抢答也不分胜负（竞争激烈/自旋超限）→ 请出**内核级排队**（互斥量、阻塞挂起）——最贵但公平稳。

只有同步那一下加锁？偏向白拿。偶发两人抢？自旋划算。长期混战？老老实实排队。

**术语速查**：偏向=记名免检｜轻量=CAS 自旋抢答｜重量=内核排队阻塞｜单向升级=不可回退

<!--advanced-->
批量重偏向/批量撤销应对同类型对象群体行为；自旋次数自适应（-XX:PreBlockSpin 语义已弱化）。15+ 废弃偏向（JEP 374）：现代应用常驻多线程 + 偏向撤销的 safepoint 代价高于收益，撤销后默认直接轻量。重量级即 ObjectMonitor：cxq→EntrySet 排队、park/unpark 挂起。
