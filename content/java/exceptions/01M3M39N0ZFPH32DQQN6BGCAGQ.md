---
id: 01M3M39N0ZFPH32DQQN6BGCAGQ
blockId: java/exceptions
relatedBlocks:
  []
question: "finally 里 return，方法返回什么？"
cardType: atomic
appliesTo: Java 17+
frequency: high
followUps:
  - 阿里规范为什么禁这个写法？
keyPoints:
  - id: kp-ex4-1
    text: "返回 finally 的值：try 的返回值与异常都被丢弃（字节码把覆盖路径编进返回）"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

答案：**finally 说了算**——try 里 `return 1`、finally 里 `return 2`，方法返回 **2**；try 抛异常而 finally return？异常被吞，照样返回 2。

机理：返回值是栈上的快照，finally 的 return 走的是**另一条退出路径**，直接改写结局。这是《阿里 Java 手册》明令禁止的写法——不是不工作，是**它会静默吃掉异常与返回值**，让排障变成玄学。

**术语速查**：退出路径竞争=finally 的 return 赢｜吞异常=异常无声消失

<!--advanced-->
JLS 14.20.2 定义精确语义；字节码中 finally-return 分支直接覆盖返回槽。IDEA/SonarLint 均有专项告警（finally 中 return/throw/break 改变控制流）。
