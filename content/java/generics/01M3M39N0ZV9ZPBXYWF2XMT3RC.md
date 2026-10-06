---
id: 01M3M39N0ZV9ZPBXYWF2XMT3RC
blockId: java/generics
relatedBlocks: []
question: List<String> 能赋给 List<Object> 吗？
cardType: judgment
conclusion: 'no'
appliesTo: Java 17+
frequency: high
followUps:
  - 数组为什么就可以协变？
keyPoints:
  - id: kp-gn4-1
    text: 不能直接赋值：泛型不协变，List<String> 不是 List<Object> 的子类型
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-gn4-2
    text: 原因：若允许，向其中 add Integer 就合法了——静态类型系统自毁
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-gn4-3
    text: 需要多态时用 List<? extends Object>（即 List<?>）读
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

**不行**，编译直接报错。表面看 String 是 Object 的子类，但 **List<String> 不是 List<Object> 的子类型**（泛型**不协变**）——假如允许：

```java
List<Object> lo = listOfString;  // 假设放行
lo.add(123);                     // Object 里当然能放 Integer
String s = listOfString.get(0);  // 💥 String 拿到 Integer
```

类型系统就自爆了。要「装各种 List」的参数用 `List<?>`（只读）。对比：**数组是协变的**（`Object[] o = strings` 合法）——代价是运行时 ArrayStoreException，这正是泛型不协变要修的历史伤。

**术语速查**：协变=子类型关系顺延到容器｜不协变=容器类型各自独立｜数组协变=历史遗留的运行时检查

<!--advanced-->
数组协变 + 具体化检查（store check）在 JVM 层维护安全；泛型擦除无法做 store check 故从编译期封死。逆变对应 ? super。List<Object> 与 List<?>：前者可写任意 Object，后者不可写。
