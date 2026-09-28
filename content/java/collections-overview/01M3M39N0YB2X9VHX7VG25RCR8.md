---
id: 01M3M39N0YB2X9VHX7VG25RCR8
blockId: java/collections-overview
relatedBlocks:
  []
question: "ArrayList 和 LinkedList 怎么选？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么说 LinkedList 实际很少用？
keyPoints:
  - id: kp-co2-1
    text: "ArrayList 底层 Object 数组：随机访问 O(1)，尾部追加均摊 O(1)"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-co2-2
    text: "LinkedList 双向链表：随机访问 O(n)，头尾插删 O(1)"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-co2-3
    text: "按索引随机访问场景几乎总选 ArrayList（CPU 缓存友好）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-co2-4
    text: "LinkedList 的真实优势场景极少：既要头删又要尾插的队列/双端"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

数据结构课的直觉是「插删多用链表」——实践中几乎总是错的：

- **ArrayList**：内存**连续**数组 → 按下标访问一步到位；CPU 缓存行友好；尾部加元素均摊 O(1)。**中间插入**也只是挪后半段（memmove 极快）。
- **LinkedList**：每个节点带前后指针 → **随机访问要顺链爬** O(n)；每元素额外两个引用的内存；缓存局部性差。

所以：**默认 ArrayList**。LinkedList 只在「双端队列」（头删尾插都频繁，如滑动窗口）这类极少场景才值回票价——而且通常 ArrayDeque 更好。

**术语速查**：随机访问=按下标直达｜缓存友好=连续内存顺序读快｜双端队列=两头都能进出

<!--advanced-->
复杂度之外的真实成本：LL 每次 new Node 的分配/GC 压力、指针追逐的 cache miss 链；AL 中间插入的 System.arraycopy 是向量化的块移动。权威基准下 AL 几乎全面胜出；Deque 场景 ArrayDeque（循环数组）同样优于 LinkedList。
