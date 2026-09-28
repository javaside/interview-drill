---
id: 01M3M7HTMBSDT1HG2V6Y5CMNY0
blockId: jvm/jvm-tools
relatedBlocks:
  []
question: "CPU 100% 怎么排查？"
cardType: sequence
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么是 GC 线程在烧 CPU？
keyPoints:
  - id: kp-jt5-1
    text: "第 1 步 top -Hp <pid>：找到吃 CPU 的线程号"
    public: true
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-jt5-2
    text: "第 2 步 线程号转 16 进制（printf %x）"
    public: true
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-jt5-3
    text: "第 3 步 jstack <pid> | grep -A 20 该 16 进制 nid：定位到代码行"
    public: true
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-jt5-4
    text: "第 4 步 看栈：业务死循环/GC 线程狂转（GC 日志佐证）/正则回溯"
    public: true
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
---

CPU 打满的**标准三连**（按步骤排）：

```
① top -Hp <pid>        → 哪个线程吃的（拿线程号）
② printf '%x' <tid>    → 转 16 进制（jstack 里的 nid 是 16 进制）
③ jstack <pid> | grep -A 20 'nid=0x..hex'  → 这线程此刻在执行哪行代码
```

看栈下**三种病因**：业务代码**死循环/重计算**（栈顶是你的方法）；**GC 线程**在烧（栈是 GCTaskThread——堆快满狂回收，去 GC 日志确认）；**正则回溯/序列化**这类库层热点。

Arthas 的 `thread -n 3` 一条命令等效三连。

**术语速查**：top -Hp=线程级 top｜nid=jstack 里的 16 进制线程号｜GC 线程烧=内存病显形为 CPU 病

<!--advanced-->
多核场景取 top 几个热点分别抓。pidstat -t 与 jstack 的时间对齐（连拍三次栈看是否钉在同一行）。GC 病根因链：泄漏/小堆→GC 频率暴涨→GC 线程占满 CPU。jit 编译线程的瞬时高 CPU 属正常。
