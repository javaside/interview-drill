---
id: 01M3M39N0YWCHF3XP50BM5S57W
blockId: java/equals-hashcode
relatedBlocks:
  - java/language-basics
  - java/hashmap
question: "重写 hashCode 有什么最佳实践？"
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - 为什么不能把所有字段都塞进 hash？
keyPoints:
  - id: kp-eh4-1
    text: "参与字段 = equals 用到的字段（完全一致，多一字段少一字段都违约）"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-eh4-2
    text: "Objects.hash(f1, f2, …) 一行生成，内部 Arrays.hashCode 风格乘 31"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-eh4-3
    text: "不可变对象可缓存 hash（String 模式），可变对象切勿缓存"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-eh4-4
    text: "追求分布：乘奇素数累加；无关字段不要掺入"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

四条实践：

1. **字段口径**：hashCode 用**且只用** equals 的字段——多算一个（equals 不看）会造成「equals 相同但 hash 不同」直接违约；少算一个则碰撞变多（不违约但变慢）；
2. **生成器**：`Objects.hash(name, age)` 一行搞定（内部就是 31 累加）；record 类自动生成成对实现；
3. **缓存**：不可变对象值得缓存 hash（String 就是）；**可变对象缓存 = 自埋地雷**（改字段后缓存过期，对象在容器里失踪）；
4. **分布**：乘奇素数（31 惯例）逐字段累加即可，别自作聪明造神 hash。

**术语速查**：口径一致=两方法同一组字段｜缓存 hash=算一次存字段｜分布=桶里排队长短

<!--advanced-->
Objects.hash 每次装箱数组（varargs），热点路径可手写 31 循环或 record 自动实现。31*i 由 JIT 转移位减法。缓存字段的内存布局/逃逸分析友好。测试：EqualsVerifier 库验证契约全套性质。
