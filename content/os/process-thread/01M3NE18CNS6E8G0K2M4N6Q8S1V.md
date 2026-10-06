---
id: 01M3NE18CNS6E8G0K2M4N6Q8S1V
blockId: os/process-thread
relatedBlocks: []
question: 死锁的四个必要条件？怎么排查和预防？
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - 死锁了怎么现场诊断？
  - 破坏哪个条件最容易？
keyPoints:
  - id: kp-pt5-1
    text: 条件 1 互斥：资源一次只能一个线程用
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: proc(5)
  - id: kp-pt5-2
    text: 条件 2 持有并候：拿着 A 候 B（不释放手里的）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: proc(5)
  - id: kp-pt5-3
    text: 条件 3 不可剥夺：不能强行抢走别人手里的锁
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: proc(5)
  - id: kp-pt5-4
    text: 条件 4 循环候：A 候 B、B 候 A 成环——四条全满足才死锁
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: proc(5)
  - id: kp-pt5-5
    text: 工程三板斧：全局加锁顺序 / tryLock 超时让路 / 一次性申请全部资源
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: proc(5)
---

死锁是**环**：每人手里攥一把钥匙，都在候对方手里那把——四个条件**缺一不死**：

1. **互斥**（资源天然独占——锁的本性，难破）；
2. **持有并候**（拿着 A 去要 B——策略可破！）；
3. **不可剥夺**（不能硬抢）；
4. **循环候**（成环）。

**工程上破第 2 条最实用**：

- **全局锁顺序**：规定「先 A 后 B」，人人遵守——环根本无法形成（转账案例：**按账户 ID 排序**再加锁）；
- **tryLock+超时**：拿不到 B 就**放手 A 退避重来**——牺牲一点吞吐买活性（数据库死锁检测的思路）；
- **一次性申请**：启动时把 A、B 全要到手再干活（银行家算法的现实简化）。

**现场诊断**：Java `jstack` 直接标出 `Found one Java-level deadlock`；MySQL `SHOW ENGINE INNODB STATUS` 看 LATEST DETECTED DEADLOCK；通用思路——**各线程栈里找互相候的锁环**。

**术语速查**：持有并候=吃着碗里候锅里|锁顺序=给锁排座次|环=死锁的形状

<!--advanced-->
活锁与饥饿（都活着但谁也干不成——tryLock 全体退避的副作用，加随机退避解）。锁的粗化与锁分段（ConcurrentHashMap 的 segment 思路）。数据库的死锁检测 vs 超时放弃（wait-for graph）。
