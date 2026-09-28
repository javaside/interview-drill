---
id: 01M3M39N0XFJ4YWXX9RK3PTZ3P
blockId: java/string
relatedBlocks:
  []
question: "String.trim() 和 strip() 的区别？"
cardType: atomic
appliesTo: Java 17+
frequency: low
followUps:
  - isBlank 和 isEmpty 呢？
keyPoints:
  - id: kp-st5-1
    text: "t"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-st5-2
    text: "isBlank 判定全空白，isEmpty 只看长度为零"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

两者都去首尾空白，但「空白」的定义不同：

- **trim()**：老方法，只认 **ASCII ≤ U+0020** 的字符（空格、	、
 这批）——中文全角空格 U+3000 它不认识。
- **strip()**（Java 11+）：按 **Unicode 空白标准**（`Character.isWhitespace`）——全角空格、各种 Unicode 空白都能去掉。

现代代码一律用 strip。配套：`isBlank()`（全是空白算空）vs `isEmpty()`（长度为 0 才算空，" " 不空）。

**术语速查**：U+0020=ASCII 空格界限｜Unicode 空白=各国语言的全套空白字符

<!--advanced-->
Character.isWhitespace 按 Unicode PropList 判定，涵盖 U+3000、NBSP 的部分变体不含（isWhitespace(NBSP)=false，而 strip 用 isWhitespace——NBSP 不被 strip 移除，细微差别要测）。11+ 还带 stripLeading/stripTrailing/lines。
