---
id: 01M3M7HTMBKPNMCKZR15CJHFC2
blockId: jvm/jvm-tools
relatedBlocks: []
question: JDK 自带的排障工具有哪些？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - CPU 100% 用哪个工具？
keyPoints:
  - id: kp-jt1-1
    text: jps：列出 JVM 进程；jstat：GC 与类加载的实时统计
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBMG22BR4930FJMMAA
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-jt1-2
    text: jmap：堆快照/直方图（histo）与 dump 导出
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
  - id: kp-jt1-3
    text: jstack：线程快照——死锁/卡顿/CPU 飙高的第一现场
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-jt1-4
    text: jinfo 运行时参数查看与修改；arthas 是线上诊断的瑞士军刀
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M7HTMBN0XP1KW4TFKH5J95
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-jt1-5
    text: JMC/jcmd 与 GC 日志（-Xlog:gc*）是趋势分析的底料
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
  - id: mc-jt1-1
    text: "jmap -dump 对线上服务无感，想导随时导"
    why: "误解：dump 要在安全点暂停整个 JVM，大堆一停秒级起步；带 live 子参数还会先触发一次 Full GC"
  - id: mc-jt1-2
    text: "jstack 只管死锁检测，CPU 飙高与它无关"
    why: "误解：CPU 飙高的第一现场正是线程栈——top 定位线程、到栈里对号找热点方法；死锁检出只是顺带功能"
---

排障工具箱按**查什么**配：

| 症状 | 工具 | 动作 |
|---|---|---|
| 进程在哪 | **jps** | 列 JVM 进程 |
| GC 健不健康 | **jstat -gcutil** | 实时各代占用与 GC 次数 |
| 内存里都是谁 | **jmap -histo** | 按类数对象（不用 dump 就能看大头） |
| 要完整现场 | **jmap -dump** | 堆快照给 MAT 分析 |
| 线程在干嘛 | **jstack** | 线程栈快照——死锁自动检出、卡在哪一目了然 |
| 线上热诊断 | **Arthas** | watch/trace/热更 无侵入 |

**术语速查**：histo=对象直方图｜dump=堆的完整快照｜线程快照=某一瞬所有线程在干嘛

<!--advanced-->
CPU 100% 三步：top 定线程号→转 16 进制→jstack 里找 nid。jmap dump 的 live 子参数先触发 full GC（慎对线上）。-Xlog:gc*（8 的 PrintGCDetails）+ GCeasy 分析。飞行记录器（JFR）的常开低开销画像。
