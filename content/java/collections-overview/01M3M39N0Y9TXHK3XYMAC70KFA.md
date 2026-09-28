---
id: 01M3M39N0Y9TXHK3XYMAC70KFA
blockId: java/collections-overview
relatedBlocks:
  []
question: "Java 集合框架的整体结构是怎样的？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - Iterator 在体系中扮演什么角色？
keyPoints:
  - id: kp-co1-1
    text: "两大接口家族：Collection（List/Set/Queue 单值）与 Map（键值对，独立体系）"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-co1-2
    text: "List 有序可重复；Set 不可重复；Queue 队列语义；Map 键唯一"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-co1-3
    text: "Map 不继承 Collection——键值对与单值是两种抽象"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-co1-4
    text: "各接口均有配套的不可变/线程安全工厂方法（List.of / Map.of）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

集合框架 = **两大族谱**：

```
Collection（装一个一个的东西）
 ├─ List：有序、可重复（ArrayList / LinkedList / Vector）
 ├─ Set：不可重复（HashSet / LinkedHashSet / TreeSet）
 └─ Queue：排队语义（ArrayDeque / PriorityQueue）
Map（装键值对）—— 独立接口，不继承 Collection
 └─ HashMap / LinkedHashMap / TreeMap / Hashtable
```

选型三问：要不要重复？→ List/Set；要不要键值对？→ Map；要不要有序/排序？→ Linked/Tree 变体。

**术语速查**：Collection=单值族根接口｜Map=键值族（独立）｜Linked 变体=保持插入序｜Tree 变体=按比较排序

<!--advanced-->
Queue 的 Deque 子接口双向操作；Iterator 统一遍历抽象（fail-fast 语义见后）。Vector/Hashtable 是遗留同步类（全方法 synchronized），新代码用并发包对应物。Collections.unmodifiableXxx 与 List.of 语义差异：前者是视图（底层可变会透出）。
