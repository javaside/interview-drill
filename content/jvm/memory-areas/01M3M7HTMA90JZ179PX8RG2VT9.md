---
id: 01M3M7HTMA90JZ179PX8RG2VT9
blockId: jvm/memory-areas
relatedBlocks: []
question: 为什么 JDK 8 用元空间替换永久代？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 永久代的经典 OOM 场景？
keyPoints:
  - id: kp-ma4-1
    text: 永久代在堆内、容量开局钉死——动态类一多就 OOM
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMAARH72QH9X6XSQBN7
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-ma4-2
    text: 元空间在本机内存，默认只受物理内存限
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-ma4-3
    text: 与 JRockit 融合的架构统一（后者无永久代概念）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-ma4-4
    text: 字符串常量池 7 起已移入堆
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
misconceptions:
  - id: mc-ma4-1
    text: "元空间只是堆内换了块地方，仍然占 -Xmx 的配额"
    why: "误解：元空间在本机内存、按需向操作系统申请；在堆里吃配额的是被它替换掉的永久代"
  - id: mc-ma4-2
    text: "字符串常量池 JDK 8 起搬进了元空间，和类信息住一起"
    why: "误解：字符串常量池 7 起就搬进了堆；留在元空间的是类元数据与每类的运行时常量池"
  - id: mc-ma4-3
    text: "元空间默认无上限，所以永远不会 Metaspace OOM"
    why: "误解：无上限只是不设人工顶，类加载失控会一路吃到物理内存上限然后照样抛 OOM；生产要设 MaxMetaspaceSize 防失控"
---

**永久代（PermGen）**是历史包袱：把「方法区」实现在 **JVM 堆里**，容量开局钉死——动态类一多（CGLib、JSP、脚本引擎）直接 **PermGen OOM**，运维只能拍脑袋调参。

**元空间（Metaspace）**的三个修复：

1. **搬到本机内存**：按需向 OS 要，不挤堆的配额；
2. **默认无上限**（MaxMetaspaceSize 可设顶防失控）；
3. **架构统一**：与 JRockit 融合，为后续 GC 演进扫清障碍。

顺带：字符串常量池 7 起搬进堆（「intern 挤爆永久代」的经典事故从此绝迹）。

**术语速查**：永久代=堆内的类信息区（钉死容量）｜元空间=本机内存的类信息区｜动态类=运行时生成的类

<!--advanced-->
元空间分配单元 Metachunk；Klass 元数据与字符串驻留分离。JEP 122 动机含 JRockit 融合与永久代调优痛苦面。
