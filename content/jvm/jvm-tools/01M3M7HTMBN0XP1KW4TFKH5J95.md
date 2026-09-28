---
id: 01M3M7HTMBN0XP1KW4TFKH5J95
blockId: jvm/jvm-tools
relatedBlocks:
  []
question: "JVM 调优的一般思路是什么？"
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - 调优的第一步是什么？
keyPoints:
  - id: kp-jt4-1
    text: "先定目标：吞吐 or 停顿——没有指标的调优是玄学"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-jt4-2
    text: "先度量：GC 日志 + 监控（GC 频次/时长/各代趋势）找瓶颈"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-jt4-3
    text: "多数问题是代码与容量：泄漏修代码、不足调 -Xmx 与分代比例"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-jt4-4
    text: "最后才是收集器与参数微调；一次只改一个变量验证"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
---

**调优四步法**（顺序不能乱）：

1. **定指标**：要吞吐（批处理）还是要停顿（在线服务）？没有目标的调优是**玄学**；
2. **拿数据**：GC 日志 + 监控——Full 频率、停顿分布、各代曲线。**先诊断再动手**；
3. **治大病**：八成问题不在 JVM 参数——**代码层**（泄漏、缓存无界、大对象）、**容量层**（堆真不够→-Xmx；新生代太小→频繁 Minor→调 -Xmn）；
4. **微调**：最后才轮到收集器切换与参数精修；**一次只改一个**，A/B 验证。

**术语速查**：指标先行=先说要什么｜度量=GC 日志说话｜一次一变量=控制实验

<!--advanced-->
调优前置检查：内存画像（jmap histo 的大头）、分配速率（Allocation Rate 决定 Minor 频率）、晋升速率（Promotion 决定老年代压力）。Arthas 的 dashboard/trace 定位业务层瓶颈常比 GC 调参收益大。
