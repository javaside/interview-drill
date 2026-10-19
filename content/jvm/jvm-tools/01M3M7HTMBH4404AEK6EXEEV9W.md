---
id: 01M3M7HTMBH4404AEK6EXEEV9W
blockId: jvm/jvm-tools
relatedBlocks: []
question: 常用的 JVM 参数有哪些？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - '-Xms 和 -Xmx 为什么常设成一样？'
keyPoints:
  - id: kp-jt3-1
    text: 内存：-Xms/-Xmx（堆初始与顶）、-Xmn（新生代）、-Xss（栈）、MetaspaceSize
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-jt3-2
    text: GC：-XX:+UseG1GC、MaxGCPauseMillis、PrintGC/HandlePromotionFailure
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMB44X28BZT234Y9BJH
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-jt3-3
    text: 排障：HeapDumpOnOutOfMemoryError、+HeapDumpPath
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBMG22BR4930FJMMAA
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-jt3-4
    text: 日志：-Xlog:gc*（9+）/ PrintGCDetails（8）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBMG22BR4930FJMMAA
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
misconceptions:
  - id: mc-jt3-1
    text: "-Xmx 限制的是 JVM 进程占用的总内存"
    why: "误解：-Xmx 只封顶堆；元空间、线程栈、代码缓存与直接内存都在配额之外，进程占用超过 -Xmx 很正常"
  - id: mc-jt3-2
    text: "-XX:MetaspaceSize 是元空间的最大上限，超过它就 OOM"
    why: "误解：MetaspaceSize 只是首次触发元空间回收的水位线；真正设顶的是 MaxMetaspaceSize，默认不设即不限"
  - id: mc-jt3-3
    text: "JDK 17 里打印 GC 详情还用 -XX:+PrintGCDetails"
    why: "误解：9 起统一日志框架，PrintGCDetails 已被移除；17 里要用 -Xlog:gc*，写老参数 JVM 直接起不来"
---

**四组高频参数**：

**内存**：`-Xms/-Xmx`（堆初始/上限——**生产设成一样**：免得堆伸缩的抖动与再分配开销）、`-Xmn`（新生代，一般让分代自适应）、`-Xss`（栈，默认 1M）、`-XX:MetaspaceSize`（元空间初始触发线）。

**GC**：`-XX:+UseG1GC`、`-XX:MaxGCPauseMillis=200`（G1 停顿目标）。

**排障**：`-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/`——OOM 留全尸，线上第一宝。

**日志**：`-Xlog:gc*:file=gc.log`（8 用 PrintGCDetails+PrintGCDateStamps）——GC 趋势分析的底料。

**术语速查**：Xms=Xmx=免伸缩抖动｜停顿目标=G1 的预算线｜OOM 留全尸=dump on error

<!--advanced-->
9+ 的 -Xlog 统一日志框架（tags/level/rotation）。容器内 -XX:+UseContainerSupport（默认开）与 MaxRAMPercentage 按比例分堆。编译参数 TieredStopAtLevel、JIT 的 ReservedCodeCacheSize。
