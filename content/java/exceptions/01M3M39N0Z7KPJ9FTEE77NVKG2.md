---
id: 01M3M39N0Z7KPJ9FTEE77NVKG2
blockId: java/exceptions
relatedBlocks: []
question: try-with-resources 是怎么工作的？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 为什么不推荐手动 close？
keyPoints:
  - id: kp-ex3-1
    text: 资源实现 AutoCloseable，try 声明即自动 close（编译器生成 finally 语义）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-ex33-2
    text: 多个资源按声明逆序关闭
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-ex3-3
    text: try 抛异常、close 也抛：close 的进 suppressed（不覆盖主异常）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-ex3-4
    text: 引用必须有效 final；Java 9 起可用 effectively final 变量直接声明
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

老写法的苦难：`InputStream in = null; try { … } finally { if (in != null) in.close(); }`——啰嗦、close 还要再 try（它也抛受检）。

**try-with-resources**：资源在 `try(...)` 括号里声明，编译器自动生成「逆序 close + 判空」的字节码：

```java
try (var in = new FileInputStream(f); var out = new FileOutputStream(g)) {
    …  // 用完自动关，先开后关
}
```

更妙的是**异常不互吞**：主体异常为主，close 的异常挂进 `getSuppressed()`——堆栈里两全其美。

**术语速查**：AutoCloseable=一个 close 方法的接口｜逆序关闭=后开的先关｜suppressed=被收纳的次要异常

<!--advanced-->
编译产物即嵌套 try+finally+addSuppressed；close 幂等性建议（重复关无害）。老式的 close 覆盖主异常问题由此根治。JDK 9 起 effectively final 引用可裸入 try(...)。Files.newBufferedReader 等流式工厂天然适配。
