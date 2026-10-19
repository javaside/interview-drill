---
id: 01M3M59WSEMZCSH9G8H0SSWWJP
blockId: concurrency/aqs-lock
relatedBlocks: []
question: ReentrantLock 的公平锁和非公平锁区别？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么默认非公平？
keyPoints:
  - id: kp-aq2-1
    text: 公平：先到先得，抢锁前查队列有无前驱
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSECPRPA13YDV6NTXD7
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-aq2-2
    text: 非公平：直接 CAS 抢，抢到算你的——默认形态
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSECPRPA13YDV6NTXD7
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-aq2-3
    text: 非公平吞吐高：省去排队唤醒的往返，但可能饥饿
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSECPRPA13YDV6NTXD7
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-aq2-4
    text: 公平锁保证无饥饿但上下文切换多
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSECPRPA13YDV6NTXD7
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
misconceptions:
  - id: mc-aq2-1
    text: "非公平锁释放时从候队线程里随机挑一个发锁，全凭手气"
    why: "误解：非公平锁释放同样按队列唤醒队头；不公只发生在锁刚空出的瞬间路人可抢先，不是抽签选人"
  - id: mc-aq2-2
    text: "公平锁慢在每次抢锁都要遍历整条候队逐个核对前驱"
    why: "误解：查前驱只瞄一眼队头下一位，开销恒定；慢在禁止插队后，队头从唤醒到跑起来那段锁空转、切换更密"
  - id: mc-aq2-3
    text: "公平锁实例上 tryLock 也守先来后到，绝不插队"
    why: "误解：无参 tryLock 一律就地直接 CAS，官方文档明说它无条件插队；守公平纪律的是 lock 与超时版 tryLock"
---

- **公平锁**：`new ReentrantLock(true)`——钥匙**按排队序**发：来抢锁先看队列里有没有人排在前面，有就老实去队尾。
- **非公平锁**（默认）：**插队自由**——锁一释放，正在路上的新线程可以**直接 CAS 抢走**，把排了一夜队的队头晾在一边。

为什么默认非公平？**吞吐**：队头被唤醒到真正跑起来有微秒级往返（内核唤醒+调度），这段时间锁白白空转；让路过的新人插队拿走，锁不停转。代价：极端竞争下某个线程**一直被插队**（饥饿）。交易系统这类「每个请求都等不起」的场景才上公平。

**术语速查**：公平=先来先得｜插队=新人直接 CAS｜饥饿=总被插队吃不上饭｜唤醒往返=叫醒队头的延迟

<!--advanced-->
非公平的 tryLock 先 CAS(state,0,1)；公平先 hasQueuedPredecessors()。吞吐差异来自 park/unpark 与调度延迟的隐藏成本（锁空闲窗口被复用）。synchronized 同为非公平语义。饥饿在极端下可观测，公平锁的上下文切换密度显著抬升。
