---
id: 01M3M59WSFE19XRY3CQJ3BVSH6
blockId: concurrency/threadlocal
relatedBlocks:
  - concurrency/thread-pools
question: 父线程修改 ThreadLocal 后子线程会看到吗？
cardType: judgment
conclusion: 'no'
appliesTo: Java 17+
frequency: high
followUps:
  - 什么时候该放弃 ThreadLocal 改显式传参？
keyPoints:
  - id: kp-tl5-1
    text: 普通 ThreadLocal：完全看不到，各线程各一张表
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSF2ZWAAB0BBFR4YXFV
      - 01M3M59WSFA2RSG2K6KNQH05AB
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/ThreadLocal.html
      locator: ThreadLocal
  - id: kp-tl5-2
    text: InheritableThreadLocal：创建子线程那一刻的快照可继承
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSFA2RSG2K6KNQH05AB
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/ThreadLocal.html
      locator: ThreadLocal
  - id: kp-tl5-3
    text: 线程池复用线程：连 ITL 的创建时机都没有，需要 TTL 搬运
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSFA2RSG2K6KNQH05AB
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/ThreadLocal.html
      locator: ThreadLocal
---

**看不到**——普通 ThreadLocal 的隔离是**彻底**的：父线程 set 的值在子线程 get 是 null（两张独立的表）。

例外一档：**InheritableThreadLocal** 在 new Thread() 那一刻抄一份快照给孩子（抄完各改各的，互不再通）。线程池连这一刻都没有（线程是老的）——上 TTL。

反过来想：如果这个值**经常需要跨线程看见**，说明它根本不该用 ThreadLocal 藏着——**显式参数**传递（看得见的依赖）比暗线（看不见的魔法）更可维护、可测试。

**术语速查**：隔离=各一张表｜快照继承=出生时抄一份｜暗线=隐式上下文的代价

<!--advanced-->
ITL 的 childValue 支持深拷贝定制（默认同引用浅抄）。Thread 的 init 里 inheritThreadLocals 分支。测试视角：TL 依赖让单例 bean 的单测需要上下文 setup。
