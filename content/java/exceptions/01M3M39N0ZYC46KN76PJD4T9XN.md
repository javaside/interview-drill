---
id: 01M3M39N0ZYC46KN76PJD4T9XN
blockId: java/exceptions
relatedBlocks: []
question: Java 异常的类层次是怎样的？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 受检 vs 非受检的本质区别？
keyPoints:
  - id: kp-ex1-1
    text: Throwable 为根：Error 与 Exception 两大分支
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-ex1-2
    text: Error：JVM 层致命错误（OutOfMemoryError/StackOverflowError），不应捕获
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-ex1-3
    text: Exception 分两支：受检异常（编译器强制处理）与运行时异常（RuntimeException 系）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-ex1-4
    text: NPE/数组越界/类转型 属运行时异常；IOException/SQLException 属受检
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

```
Throwable
 ├─ Error                    —— JVM 崩了（内存耗尽/栈溢出），救不了也不用救
 └─ Exception
     ├─ RuntimeException     —— 运行时（非受检）：NPE、越界、ClassCastException
     └─ 其余                 —— 受检：IOException、SQLException（编译器逼你处理）
```

**受检**：编译器查岗——方法签名 throws 声明，调用者必须 try 或继续抛。**非受检**：编程错误的信号（空指针本可避免），不强制处理，炸出来修代码。

**术语速查**：Error=JVM 级致命｜受检=编译器强制处理｜RuntimeException=编程缺陷类

<!--advanced-->
受检的设计争议（C# 没有）：大量无法恢复的场景被迫 try-catch 污染签名；JDK 8 Lambda/Stream 里受检异常尤其碍事（包装 RuntimeException 成惯例）。异常链 cause 保留原始堆栈；suppressed 由 try-with-resources 收集关闭期异常。
