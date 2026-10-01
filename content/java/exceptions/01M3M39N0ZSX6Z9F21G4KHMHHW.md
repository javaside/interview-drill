---
id: 01M3M39N0ZSX6Z9F21G4KHMHHW
blockId: java/exceptions
relatedBlocks:
  []
question: "finally 的执行时机和坑？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - finally 能「取消」return 吗？
keyPoints:
  - id: kp-ex2-1
    text: "正常/异常/return 三种路径都会先走 finally 再结束方法"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-ex2-2
    text: "坑 1：finally 里 return 会吞掉 try 的返回值与异常"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-ex2-3
    text: "坑 2：finally 里抛异常会顶替 try 的原始异常"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-ex2-4
    text: "finally 在 return 表达式求值之后、真正返回之前执行"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

**finally 必然执行**——try 里 return、抛异常都拦不住它；顺序是：return 的**表达式先求值**（值放一边）→ 执行 finally → 才真正返回。

两个著名坑，都源于「finally 里放错了东西」：

1. **finally 里 return**：直接吞掉 try 的返回值/异常——方法返回 finally 的值，原异常凭空消失；
2. **finally 里抛新异常**：顶替 try 的原始异常（原始信息丢，排查地狱）。

规矩：**finally 只做清理（关流/解锁），绝不 return、绝不再抛**——需要自动清理用 try-with-resources。

**术语速查**：求值先于返回=值算好放栈上等 finally｜吞异常=原异常被覆盖丢失

<!--advanced-->
字节码层 finally 复制到各退出路径（athrow 前/return 前）；JIT 有快速路径。System.exit/halt 与 JVM crash 不执行 finally。finally 中赋值返回值变量同样无效（值已快照）——除非 return 那个变量写在这里（即坑 1）。
