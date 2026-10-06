---
id: 01M3NE18CNS5D7F9H1J3M5N7R9T
blockId: os/process-thread
relatedBlocks: []
question: 线程同步有哪些方式？各自适用什么场景？
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - 什么时候自旋比互斥好？
  - 条件变量为什么要配互斥锁？
keyPoints:
  - id: kp-pt4-1
    text: 互斥锁：同一时刻一个线程进临界区——拿不到就睡（上下文切换）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: futex(7)
  - id: kp-pt4-2
    text: 自旋锁：拿不到原地忙候——无切换烧 CPU，临界区极短才划算
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: futex(7)
  - id: kp-pt4-3
    text: 条件变量：候某条件成立——配互斥锁用（候通知再醒）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: futex(7)
  - id: kp-pt4-4
    text: 读写锁：读共享写独占——读多写少场景吞吐高
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: futex(7)
  - id: kp-pt4-5
    text: 信号量：计数器控制并发名额（连接池限流）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: futex(7)
---

同步原语按「**候的方式**」与「**放几个人进**」分族：

- **互斥锁（mutex）**：**睡候**——拿不到锁就挂起（让出 CPU），被唤醒再试。适合临界区**较长**（>两次上下文切换的开销）的通用场景；Linux 的实现混合两段：**先自旋几圈再睡**（adaptive）；
- **自旋锁（spinlock）**：**站候**——拿不到就原地空转烧 CPU。免了上下文切换（微秒级开销），**核内（内核态）/极短临界区**才划算；候久了纯浪费 CPU——单核上自旋更是死路（持有者根本没机会跑）；
- **条件变量（condvar）**：互斥锁解决「怎么进去」，它解决「**候什么条件**」——`while(条件不满足) wait()`（wait 会原子地放锁+睡，醒来重新抢锁）。**必须配互斥锁**：检查条件与入睡之间不能被插队（丢失唤醒）；
- **读写锁**：读共享、写独占——读多写少（配置/字典）吞吐起飞；写饥饿问题用「写优先」变体缓解；
- **信号量（semaphore）**：N 个名额——限并发（连接池最多 10 个同时用）：`acquire` 减、`release` 加，0 就候。

**术语速查**：睡候 vs 站候=切换开销与 CPU 浪费的取舍|丢失唤醒=不配锁的经典事故|名额控制=信号量的本职

<!--advanced-->
futex（fast userspace mutex——无竞争时纯用户态原子操作，有竞争才进内核——Linux 上的地基层）。seqlock 与 RCU（读端零开销——内核高并发读的法宝）。公平性与「锁护送」(lock convoy)。
