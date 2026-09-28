---
id: 01M3M39N0YXSC9CC75JQX0ZQET
blockId: java/collections-overview
relatedBlocks:
  []
question: "HashSet、LinkedHashSet、TreeSet 的区别？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 自定义对象放 HashSet 需要重写什么？
keyPoints:
  - id: kp-co4-1
    text: "HashSet：哈希去重，无序，增删查 O(1)——默认选择"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-co4-2
    text: "LinkedHashSet：HashSet + 双向链表记插入序，遍历按放入顺序"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-co4-3
    text: "TreeSet：红黑树按比较序（自然序或 Comparator），O(log n)"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-co4-4
    text: "去重判定 HashSet 用 hash+equals；TreeSet 用 compareTo/compare（0 即重复）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

三个 Set，差在**顺序**和**代价**：

- **HashSet**：无序哈希集，O(1)——不在乎顺序的默认选择（去重判定 = hashCode 定位 + equals 确认）。
- **LinkedHashSet**：多花一点内存维护**插入顺序**的链——遍历时的顺序 = 放进去的顺序。
- **TreeSet**：红黑树，**按大小排好序**（自然序或你给的 Comparator），代价 O(log n)——需要「排序/范围查询（headSet/tailSet）」才用。

注意去重口径不同：HashSet 系走 **equals**；TreeSet 走 **compare 返回 0**——两个 equals 相同但 compare 不为 0 的对象能同时进 TreeSet。

**术语速查**：插入序=放进去的顺序｜比较序=按大小规则排｜范围查询=取某区间内的元素

<!--advanced-->
LHS 促销 LinkedHashMap 的 accessOrder=false 形态；TreeSet 即 TreeMap 的键视图。HashSet 初始容量 16 负载 0.75 与 HashMap 同源。自定义对象入 HashSet 必须重写 hashCode+equals；入 TreeSet 提供 compareTo 一致性（建议与 equals 一致以免语义割裂）。
