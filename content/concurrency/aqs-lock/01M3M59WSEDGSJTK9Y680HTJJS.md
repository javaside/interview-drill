---
id: 01M3M59WSEDGSJTK9Y680HTJJS
blockId: concurrency/aqs-lock
relatedBlocks: []
question: ReadWriteLock 的适用场景和坑？
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - 锁降级怎么写、为什么安全？
keyPoints:
  - id: kp-aq4-1
    text: 读写分离：读读共存、读写/写写互斥——读多写少场景吞吐起飞
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSF16SCYSM5EVS1C59W
      - 01M3M59WSFF26KY8FVRTKXXDJA
      - 01M3NE18CNY8W0B2D4F6H8K0N2
      - 01M3NE18CNY9X1C3E5G7J9M1P3
      - 01M3NE18CP04F0H2J4M6Q8S0V2
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-aq4-2
    text: ReentrantReadWriteLock：可重入、支持锁降级（写→读）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNY8W0B2D4F6H8K0N2
      - 01M3NE18CP04F0H2J4M6Q8S0V2
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-aq4-3
    text: 坑：读线程长期占据可饿死写（写饥饿）——公平模式可解但降吞吐
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNY8W0B2D4F6H8K0N2
      - 01M3NE18CP04F0H2J4M6Q8S0V2
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-aq4-4
    text: StampedLock 的乐观读：不拿锁先读，验证戳未变即有效——读路径零锁
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSF16SCYSM5EVS1C59W
      - 01M3NE18CNY8W0B2D4F6H8K0N2
      - 01M3NE18CP04F0H2J4M6Q8S0V2
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

**读写锁**按用途拆锁：**读锁**大家共享（读读不互斥）、**写锁**独占（读写/写写互斥）。读多写少（配置、缓存、词典）的吞吐救星。

两个进阶点：

- **锁降级**（写→读）：`持写锁 → 改数据 → 拿读锁 → 放写锁 → 读着用 → 放读锁`——保证自己写的立刻被自己一致地读到（中途别人插不进写）；
- **写饥饿**：读一直不断，写永远排队——RRWL 默认非公平下真实存在；换公平模式（性能换秩序）或 StampedLock。

**StampedLock**（18+）：**乐观读**——不加锁先读、再验「期间没人写过」（戳比对），没变直接用——**读零锁开销**。

**术语速查**：读锁=共享｜写锁=独占｜降级=写完换读不掉一致性｜乐观读=先读后验证免锁

<!--advanced-->
RRWL 的 state 高 16 位读计数/低 16 位写计数（一个 int 拆两半）；HoldCounter 记每线程读重入。降级的安全性：持写锁期间拿读锁合法（反向「升级」死锁风险被禁止）。StampedLock 乐观读循环 validate(stamp) 失败升级悲观读；不可重入是其限制。
