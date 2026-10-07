---
id: 01M3M39N0YSQCVGCANWW33S0N7
blockId: java/equals-hashcode
relatedBlocks:
  - java/language-basics
  - java/hashmap
question: 只重写 equals 不重写 hashCode 会发生什么？
cardType: atomic
appliesTo: Java 17+
frequency: high
followUps:
  - set.contains 为什么时灵时不灵？
keyPoints:
  - id: kp-eh3-1
    text: 两个内容相同的对象 hash 不同 → 落入 HashMap 不同桶 → contains/get 找不到、HashSet 去重失效
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0YJQ9ETGS6ZDRW1J9B
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

具体症状一行流：**对象放进 HashSet 后，用内容相同的新实例去 contains，返回 false**。

机理：contains 按新实例的 hashCode 定桶——Object 默认的 hash 是**地址相关**的，两个实例 hash 不同 → 找错了桶 → 连 equals 比对的机会都没有 → false。「时灵」是因为偶尔两个对象碰巧同桶，才轮到 equals 说话。

**术语速查**：找错桶=hash 定位就偏了｜时灵时不灵=碰撞与否决定 equals 有无出场机会

<!--advanced-->
HashMap.getNode：先 (n-1)&hash 定桶再比对 hash 与 equals。修复=两个字段参与集合（equals+hashCode）一致；Lombok @EqualsAndHashCode / record 的紧凑实现自动成对。
