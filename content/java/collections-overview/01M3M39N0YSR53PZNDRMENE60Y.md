---
id: 01M3M39N0YSR53PZNDRMENE60Y
blockId: java/collections-overview
relatedBlocks: []
question: Comparable 和 Comparator 的区别？
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - 为什么 JDK 类推荐 Comparable 与 equals 一致？
keyPoints:
  - id: kp-co5-1
    text: Comparable：类自身实现 compareTo，定义「天生排序」（内部比较器）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-co5-2
    text: Comparator：类外的独立比较器，定义临时排序策略
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-co5-3
    text: TreeMap/TreeSet/Arrays.sort 均可选其一
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0YXSC9CC75JQX0ZQET
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-co5-4
    text: Comparator 可组合链（thenComparing）与逆转（reversed）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

两条路给对象定「大小」：

- **Comparable**（`class A implements Comparable<A>`）：类**自己**实现 `compareTo`——这是它的**天生排序**（如 String 按字典序、Integer 按数值）。一个类只有一种。
- **Comparator**（独立的比较器对象）：**外面**交给它比——同一批对象可以有 N 种排法（按年龄、按姓名、按工资），lambda 一写一个。

需要排序列表时：元素实现了 Comparable → `sort(list)`；否则 `sort(list, 比较器)`。Comparator 还能 `thenComparing` 串多字段、`reversed()` 倒序。

**术语速查**：compareTo=天生排序｜Comparator=外部策略｜thenComparing=次级排序键

<!--advanced-->
约定：sgn(compare(x,y)) = -sgn(compare(y,x))、传递性、(x.compareTo(y)==0) == x.equals(y) 强烈建议一致（TreeSet/TreeMap 语义直接采用前者，不一致会造成「相等却共存」的排序集合怪象）。Comparator 的 nullsFirst/naturalOrder 为常用组合件。
