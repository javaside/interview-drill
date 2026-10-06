---
id: 01M3M39N0ZMFXRFEA8Z56QTXX6
blockId: java/reflection-proxy
relatedBlocks: []
question: 反射的性能开销在哪？怎么优化？
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - Method 查找为什么贵？
keyPoints:
  - id: kp-rf5-1
    text: 开销：方法/字段查找（按名匹配）、参数装箱与检查、调用无法内联
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-rf5-2
    text: 缓存 Method/Field 对象（重复 getDeclaredMethod 很贵）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-rf5-3
    text: setAccessible(true) 跳过访问检查也是提速点
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-rf5-4
    text: 极端优化换 MethodHandle/LambdaMetafactory 或代码生成（ASM）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

反射慢在三层：

1. **查找**：`getDeclaredMethod("foo", …)` 要按字符串遍历匹配——**别在循环里反复找**，找到的 Method 对象缓存起来；
2. **调用**：参数**装箱**、类型检查、无法被 JIT **内联**（JIT 看不穿反射目标）；
3. **检查**：每次调用的访问权限检查（setAccessible(true) 顺手关掉）。

优化阶梯：缓存 Method → setAccessible → （热点）换 **MethodHandle/LambdaMetafactory**（可被 JIT 当作普通调用优化）→ （框架级）ASM 直接生成字节码。

**术语速查**：装箱=基本值包一层对象｜内联=JIT 把方法体抄进调用处｜MethodHandle=现代可优化句柄

<!--advanced-->
Reflection 的 inflation 机制（默认 15 次后生成 GeneratedMethodAccessorN 专门类）——但 17 起默认 no-inflation 改善冷启动。JMH 基准下反射调用比直接慢 1~2 倍（现代 JIT 已大为收敛），瓶颈常在滥用模式（每次查方法）。
