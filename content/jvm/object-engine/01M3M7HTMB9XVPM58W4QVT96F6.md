---
id: 01M3M7HTMB9XVPM58W4QVT96F6
blockId: jvm/object-engine
relatedBlocks:
  - jvm/gc-basics
question: "什么是 JIT 与逃逸分析？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么局部 new 的对象可能不进堆？
keyPoints:
  - id: kp-oe3-1
    text: "JIT：热点代码（计数器达标）编译成本机机器码——越跑越快"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-oe3-2
    text: "逃逸分析：对象是否跑出方法/线程的作用域"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-oe3-3
    text: "不逃逸对象的优化：栈上拆解（标量替换）、锁消除、不死码剪除"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
  - id: kp-oe3-4
    text: "分层编译：C1 快速编译保启动，C2 深度优化保峰值"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
---

**解释执行→越跑越快**的秘密是 **JIT（即时编译）**：

- **热点探测**：方法调用计数器/回边计数器超标 → 这个方法/循环被编译成**本机机器码**（不再逐条解释字节码）；
- **分层编译**：C1（快编译、一般优化——启动初期）→ 升温后 C2（慢编译、激进优化——峰值性能）。

**逃逸分析**是 C2 的神来之笔：分析「这个 new 的对象**跑不跑得出**当前方法/线程」——**跑不出去**（不逃逸）就三连优化：

1. **标量替换**：对象干脆不建——字段拆成局部变量（**栈上**，堆无分配零 GC 压力）；
2. **锁消除**：不逃逸的局部对象加的锁毫无意义——直接删；
3. 同步裁剪与死码消除。

**术语速查**：热点=跑得足够多的代码｜逃逸=对象溜出方法边界｜标量替换=对象拆散上栈

<!--advanced-->
方法调用计数器（15000 默认）与回边计数（OSR 栈上替换让长循环中途换机器码）。逃逸的判定：返回值/存入字段/传入未知方法。聚合量 vs 标量的拆分。逆优化（deopt）：C2 的激进假设（如未加载的类）失效时回退解释器。
