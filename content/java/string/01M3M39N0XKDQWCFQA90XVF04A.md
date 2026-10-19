---
id: 01M3M39N0XKDQWCFQA90XVF04A
blockId: java/string
relatedBlocks: []
question: String 为什么设计成不可变的？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 不可变带来了什么性能代价？
keyPoints:
  - id: kp-st1-1
    text: 不可变对象可安全共享：字符串常量池、缓存 hashCode 成为可能
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0XRJKYFZ9RXS69XV5Z
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-st1-2
    text: 天然线程安全，无需任何同步
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0XRJKYFZ9RXS69XV5Z
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-st1-3
    text: 作为 HashMap 的 key 安全：hashCode 可缓存且永不变化
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0XRJKYFZ9RXS69XV5Z
      - 01M3M39N0YA1HP86YF1S7YW43K
      - 01M3M39N0YJQ9ETGS6ZDRW1J9B
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-st1-4
    text: 类final + 私有char数组 + 不提供修改方法，三者共同保证不可变
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0XRJKYFZ9RXS69XV5Z
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-st1-5
    text: 字符串常量池让同一字面量全 JVM 只存一份
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0X1EYQ2CC05QDYQ0QM
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17

misconceptions:
  - id: mc-st1-1
    text: 把内部数组声明成 final 就足以保证不可变，类加不加 final 无所谓
    why: 误解：final 只锁住数组引用，数组内容照样能改，类不封死还会被继承者开出后门
  - id: mc-st1-2
    text: replace、substring 这些方法直接在原字符串上就地修改
    why: 误解：修改类方法一律返回新字符串对象，原串从创建到回收内容分毫不变
---

`String s = "a"; s += "b";` 每一步都在造**新对象**——因为 String 一旦生成就**终生不变**。为什么这么设计？三个红利：

1. **共享安全**：所有引用同一串的地方不用担心被谁偷偷改了——所以才有**字符串常量池**（同一个 "abc" 全 JVM 只存一份）；
2. **线程安全**：不可变对象天生并发安全，零同步成本；
3. **HashCode 可信**：String 把 hash 算一次缓存起来——因为它永远不会变。这也是它当 HashMap key 的底气（key 的 hash 变了，元素就失踪了）。

实现三板斧：类是 **final**（不许继承绕过）、内部字符数组**私有**且 final、**不提供任何修改方法**。

**术语速查**：不可变=创建后内容永不改变｜常量池=同串复用的存储区｜hash 缓存=只算一次存起来

<!--advanced-->
不可变还带来安全语义：路径/主机名/类名以 String 传递时不可能在使用途中被篡改（时序安全）。代价是频繁拼接产生中间对象——循环拼接必须用 StringBuilder。9+ 底层由 char[] 改 byte[] + coder（LATIN1/UTF16）省内存。
