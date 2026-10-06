---
id: 01M3M39N0X1EYQ2CC05QDYQ0QM
blockId: java/string
relatedBlocks: []
question: String s = new String(「abc」) 创建了几个对象？
cardType: judgment
conclusion: depends
appliesTo: Java 17+
frequency: high
followUps:
  - intern() 的作用是什么？
keyPoints:
  - id: kp-st3-1
    text: 常量池中若无 abc 则先在池里创建一个
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-st3-2
    text: new 在堆里再创建一个独立对象（不指向池）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-st3-3
    text: 答案是 1 或 2 个：取决于字面量此前是否已入池
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-st3-4
    text: 字符串字面量在类加载的常量池解析阶段登记
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

经典面试题，拆开看这行代码的两步：

1. `"abc"` 这个**字面量**：类加载时若常量池里还没有，就在**池**里放一个；
2. `new String(...)`：在**堆**里再造一个**全新**对象（内容拷贝一份，跟池里那个不是同一个）。

所以答案是：**常量池已有 "abc" → 1 个（只有堆对象）；没有 → 2 个（池 + 堆）**。`s.intern()` 可以把堆对象对应的引用换成池里的那个（池没有则登记入池）。

**术语速查**：字面量=代码里直接写出的 "abc"｜入池=常量池登记｜intern=主动换取池内引用

<!--advanced-->
字符串字面量在类加载的常量池解析阶段 intern；invokedynamic 拼接的动态串默认不入池。intern 在 7+ 位于本地堆而非 Perm。用 == 判断 s == s.intern() 可检验是否为池引用——仅作理解，生产禁用。
