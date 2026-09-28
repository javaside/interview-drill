---
id: 01M3M39N0YX2ADDB4VJHFJY98B
blockId: java/equals-hashcode
relatedBlocks:
  - java/language-basics
  - java/hashmap
question: "equals 和 hashCode 之间的契约是什么？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 违反契约的具体症状是什么？
keyPoints:
  - id: kp-eh2-1
    text: "equals 相同 ⇒ hashCode 必须相同（硬性要求）"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-eh2-2
    text: "hashCode 相同 ⇏ equals 相同（碰撞合法，只是性能问题）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-eh2-3
    text: "只重写 equals 不重写 hashCode：对象进 HashMap/HashSet 后找不到"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-eh2-4
    text: "IDE/Objects.hash 可生成合格实现；参与字段必须与 equals 完全一致"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

一条**单向硬约束**：

> **equals 判定相同的两个对象，hashCode 必须相同。**

反方向不要求（hash 相同是碰撞，合法，只是桶里排队）。

只重写 equals 不重写 hashCode 的**典型事故**：两个「内容相同」的对象 hash 不同（Object 默认按地址）→ HashMap 把它们放进**不同的桶** → `map.containsKey(同样内容的对象)` 返回 **false**，set 去重失效——明明 equals 说相同，容器说找不到。

**术语速查**：单向硬约束=等 ⇒ hash 同｜碰撞=hash 同但不等｜参与字段=equals 用的那组字段

<!--advanced>>
HashSet 本质 HashMap 的键集，contains 即 getEntry。合理的 hash：Objects.hash(f1,f2) 或 31 惯例手工；质数乘子分布佳。布尔可用 1231/1237、long 拆 32 位异或。缓存 hash 字段适合不可变对象（String 模式）。
