---
id: 01M3M59WSFHJNM8DE7H0EJPN2T
blockId: concurrency/threadlocal
relatedBlocks: []
question: ThreadLocal 为什么会内存泄漏？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 弱引用不是用来防泄漏的吗？
keyPoints:
  - id: kp-tl2-1
    text: Entry 的键是弱引用：ThreadLocal 对象可被回收，键变 null
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSF2ZWAAB0BBFR4YXFV
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tl2-2
    text: 但值是强引用：键 null 的条目里值仍被线程牵着
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSF2ZWAAB0BBFR4YXFV
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tl2-3
    text: 线程长期存活（线程池）→ null 键条目累积 → 值无法回收
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSF2ZWAAB0BBFR4YXFV
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-tl2-4
    text: 根治：用完 finally 里 remove()（try-with-resources 亦可）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

经典追问链。泄漏的**路径**：

1. ThreadLocal 实例没了（外部强引用断开）→ 弱引用键被 GC → 条目键变 **null**；
2. 但**值还是强引用**——只要**线程活着**（线程池的线程几乎永生），这个「无主值」就一直被 map 牵着 → **泄漏**。

弱引用的作用恰恰相反于直觉：它救的是 **ThreadLocal 对象本身**（让键能断），**断完留下的孤儿值**才需要 `remove()` 收尸。set/get 时 map 会顺路清理一些 null 键条目（启发式），但不保证及时。

**规范**：`try { tl.set(x); … } finally { tl.remove(); }`——尤其 web 请求/池线程这种复用场景。

**术语速查**：弱引用键=钥匙会先消失｜孤儿值=键没了值还被牵着｜remove=用完收尸

<!--advanced-->
探测式清理在 set/get 的散列路径上（连续段内 expunge）；replaceStaleEntry 的启发式上限（探测到 len 之前的 stale 段）。线程终止时 threadLocals 整表无引用可回收（池线程不终止即根源）。静态 long-lived ThreadLocal（如 SimpleDateFormat 池化持有）键永不失效反而不漏——泄漏特指「键死值活」。
