---
id: 01M3M59WSFA2RSG2K6KNQH05AB
blockId: concurrency/threadlocal
relatedBlocks: []
question: InheritableThreadLocal 和 TransmittableThreadLocal 解决什么？
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - 为什么 ITL 在线程池里失效？
keyPoints:
  - id: kp-tl4-1
    text: ITL：父线程创建子线程时拷贝上下文给子线程
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSFE19XRY3CQJ3BVSH6
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tl4-2
    text: 局限：线程池的线程早已创建——复用时不再发生拷贝
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSFE19XRY3CQJ3BVSH6
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tl4-3
    text: TTL（阿里）：提交任务时抓快照、执行时回放——池化场景的上下文搬运工
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSFE19XRY3CQJ3BVSH6
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tl4-4
    text: 用法：TtlRunnable.get(runnable) 包装或 Agent 字节码增强
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

- **InheritableThreadLocal**：**创建子线程那一刻**把父线程的值抄给孩子——`new Thread()` 场景 OK；
- **线程池**的线程是**早就建好反复复用**的——你提交任务时根本没有「创建线程」这回事，抄值时机**不存在** → 上下文丢失（拿到的是创建池那线程的老值，或 null）。

**TTL（TransmittableThreadLocal）**把搬运时机改到**任务提交时**：`TtlRunnable.get(task)` 包装——提交瞬间抓父线程快照，任务在池线程**执行前回放**进该线程的 TTL，执行完还原。池化 + 异步的上下文传递标准解（Agent 方式可零侵入）。

**术语速查**：创建时拷贝=ITL 的一次性抄送｜提交时快照=TTL 的随单附页｜回放=执行前贴上下文

<!--advanced-->
TtlRunnable 的 capture/replay/restore 三拍；重入执行还原防串味。CompletableFuture 默认 commonPool 同样需要包装（or CompletableFuture + 上下文感知 executor）。Spring 的 RequestContextHolder 在异步的失效同源，RequestContextFilter 的可传播包装是另一种 TTL 化。
