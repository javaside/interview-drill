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
    excludeAsDistractorFor:
      - 01M3M39N0ZPY04TDHYNN09KFS7
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
    excludeAsDistractorFor:
      - 01M3M39N0ZPY04TDHYNN09KFS7
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-ex3-4
    text: Java 9 起可直接把外部已声明、从未重新赋值的变量（effectively final）放进 try(...)
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0ZPY04TDHYNN09KFS7
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

Java 9 起，括号里还可以直接放**外面已有的变量**——条件是它从赋值后**从未被重新赋值**（这种「事实上不可变」的变量叫 effectively final，没写 final 关键字但效果等同）：

```java
var in = Files.newInputStream(path);  // 外面声明
try (in) { … }                        // Java 9+：直接放进去，用完照样自动关
```

为什么要求「从未重新赋值」？编译器要把这个变量抄进自动生成的关闭逻辑——如果你中途让它指向别的对象，它就不知道该关哪个了。

更妙的是**异常不互吞**：主体异常为主，close 的异常挂进 `getSuppressed()`——堆栈里两全其美。

**术语速查**：AutoCloseable=一个 close 方法的接口｜逆序关闭=后开的先关｜suppressed=被收纳的次要异常｜effectively final=没写 final 但从未重新赋值

<!--advanced-->
编译产物即嵌套 try+finally+addSuppressed；close 幂等性建议（重复关无害）。老式的 close 覆盖主异常问题由此根治。JDK 9 起（JEP 213）effectively final 引用可裸入 try(...)。Files.newBufferedReader 等流式工厂天然适配。
