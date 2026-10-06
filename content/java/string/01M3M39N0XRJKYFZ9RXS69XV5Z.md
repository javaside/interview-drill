---
id: 01M3M39N0XRJKYFZ9RXS69XV5Z
blockId: java/string
relatedBlocks: []
question: String、StringBuilder、StringBuffer 怎么选？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 编译器会把 + 优化成 StringBuilder 吗？
keyPoints:
  - id: kp-st2-1
    text: String 不可变：少量固定字符串直接用
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-st2-2
    text: StringBuilder 可变且非线程安全：单线程拼接的首选（最快）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-st2-3
    text: StringBuffer 可变且方法加 synchronized：多线程共享拼接才需要
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-st2-4
    text: 循环内用 + 拼接 = 每轮新建对象，必须换 StringBuilder
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-st2-5
    text: StringBuilder 可预设容量避免反复扩容拷贝
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

按场景选：

- **String**：字符串**固定**、拿来就用——最普通的情况。
- **StringBuilder**：需要**反复改**（循环拼接、动态构建）且单线程——它内部维护可变字符数组，append 不产生新对象，**最快**。
- **StringBuffer**：和 StringBuilder 一模一样，只是方法全加了 **synchronized**——**多个线程共享同一个拼接器**才值得付出同步开销（罕见）。

最常见的性能事故：**循环里用 + 拼接**——每轮都 new 一个新 String（旧的作废），循环一万次造一万个对象。换 `StringBuilder.append` 即愈。

**术语速查**：可变=内部数组可扩容复用｜synchronized=方法级加锁｜循环拼接=必须 StringBuilder

<!--advanced-->
单表达式 "a"+x+"b" 会被 javac 优化为 StringBuilder 链（invokedynamic 的 makeConcat 9+），但循环内 + 每轮新建 builder。SB 初始容量 16，可预估传入避免多次扩容拷贝（扩容为 (cap+1)*2 上限附近）。
