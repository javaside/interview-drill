---
id: 01M3M59WSEHSMWYDSYW8CRMY0F
blockId: concurrency/aqs-lock
relatedBlocks: []
question: Condition 相比 wait/notify 的优势？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 生产者消费者的双 Condition 怎么设计？
keyPoints:
  - id: kp-aq3-1
    text: 一把锁多个条件队列：不同条件的阻塞各排各的队
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSECPRPA13YDV6NTXD7
      - 01M3M59WSFQ6DJYJ18QPFWZQBD
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-aq3-2
    text: 精准唤醒：notFull.signal 只唤醒在「不满」条件上候着的线程
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSECPRPA13YDV6NTXD7
      - 01M3M59WSFQ6DJYJ18QPFWZQBD
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-aq3-3
    text: wait/notify 只有一间全员候车室，notify 叫醒谁全凭运气
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSECPRPA13YDV6NTXD7
      - 01M3M59WSFQ6DJYJ18QPFWZQBD
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-aq3-4
    text: await/signal 必须持锁调用（同 wait/notify 的纪律）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSFQ6DJYJ18QPFWZQBD
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
misconceptions:
  - id: mc-aq3-1
    text: "signalAll 与 notifyAll 一样，把锁上全部条件队列的线程统统叫醒"
    why: "误解：signalAll 只清空自己所属的那一个条件队列；对监听器全体候车人广播的是 notifyAll"
  - id: mc-aq3-2
    text: "线程被 signal 叫醒后立刻从 await 处继续跑，不用重新抢锁"
    why: "误解：醒来只是离开条件队列、转去重新竞争锁，抢到手才从 await 返回——signal 只是挪位，不算放行"
  - id: mc-aq3-3
    text: "不持锁调用 Condition.await 照常工作，只是少了层保护"
    why: "误解：不持锁调用 await 当场抛 IllegalMonitorStateException；它和 wait 用同一套规矩，先持锁再进门"
---

`wait/notify` 的痛：一个对象锁只有**一间候车室**——生产者消费者全挤一起，`notify()` 随手叫醒一个：消费者叫醒消费者、白站一站（虚假唤醒还得 while 兜底）。

**Condition** = 一把锁配**多间候车室**：

```java
Lock lock = new ReentrantLock();
Condition notFull  = lock.newCondition();   // 「没满」候车室：生产者满时在这睡
Condition notEmpty = lock.newCondition();   // 「没空」候车室：消费者空时在这睡

put(): 满了 → notFull.await();  放入后 → notEmpty.signal();  // 只叫消费者
take(): 空了 → notEmpty.await(); 拿走后 → notFull.signal();  // 只叫生产者
```

**精准唤醒**：signal 只响一间房，绝不叫错人。纪律与 wait/notify 相同：**必须持锁** await/signal；await 醒来要用 while 重核条件。

**术语速查**：条件队列=按条件分房候车｜精准唤醒=叫对房间｜持锁纪律=无锁调用抛异常

<!--advanced-->
await 流程：addConditionWaiter → fullyRelease（全量释放重入计数）→ parkOnSelf；signal 将首节点 transferForFirstNode 迁回 CLH 队尾（状态 0/SIGNAL 竞争恢复）。synchronized 的 WaitSet 即单间原型。timeout/不可中断变体与 reportMissingToken 语义同 Object 系列。
