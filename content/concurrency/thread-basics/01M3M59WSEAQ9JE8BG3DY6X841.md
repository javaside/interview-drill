---
id: 01M3M59WSEAQ9JE8BG3DY6X841
blockId: concurrency/thread-basics
relatedBlocks: []
question: 线程有哪几种状态？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - sleep 和 wait 分别落在哪个状态？
keyPoints:
  - id: kp-tb3-1
    text: NEW：创建了未 start
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb3-2
    text: RUNNABLE：可运行（含运行中和就绪，Java 不区分）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb3-3
    text: BLOCKED：抢 monitor 锁未果，阻塞在同步块外
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb3-4
    text: WAITING / TIMED_WAITING：park/join/sleep 造成的无限或限时停泊
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tb3-5
    text: TERMINATED：run 结束（正常或异常），不可复生
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

Java 线程的**六态**（Thread.State）：

```
NEW ──start()──► RUNNABLE ⇄ BLOCKED（抢锁失败）
                    ⇅
              WAITING / TIMED_WAITING（主动停泊）
                    ↓
               TERMINATED（run 跑完，终身一次）
```

关键区分：**BLOCKED** 是「抢内置锁没抢到」被拦在门外；**WAITING/TIMED_WAITING** 是自己调了 wait/join/sleep/park **主动停船**。RUNNABLE 在 Java 里含「就绪+运行」两种 OS 态（还含 IO 阻塞——Java 视角「可运行」）。

**术语速查**：RUNNABLE=就绪+运行｜BLOCKED=锁大门外｜WAITING=主动停泊｜TERMINATED=终局不可逆

<!--advanced-->
OS 侧细分 ready/running 由调度器管理，JLS 刻意合并以跨平台。IO 阻塞在 Java 仍是 RUNNABLE（JDK 不感知 socket 阻塞语义）——线程 dump 里 runnable 的线程可能在等网络。BLOCKED 仅对 monitor（synchronized）成立；LockSupport.park 落 WAITING。
