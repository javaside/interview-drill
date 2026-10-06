---
id: 01M3M39N0ZPY04TDHYNN09KFS7
blockId: java/exceptions
relatedBlocks: []
question: 异常处理的最佳实践有哪些？
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - 为什么抓栈很贵？
keyPoints:
  - id: kp-ex5-1
    text: 别捕获后吞掉：空 catch 块是排障黑洞，至少记日志或转译重抛
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-ex5-2
    text: 别 catch (Exception) 一把梭：按预期异常精确捕获，意外错误让它炸
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-ex5-3
    text: 异常别用于流程控制：构建异常对象要抓栈，代价高
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-ex5-4
    text: 底层异常转译成业务异常再抛，保留 cause 链与上下文信息
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

四条铁律：

1. **不许吞**：`catch (E e) {}` 空块 = 事故现场被抹掉——最起码 log.error（带异常对象），或者转译后重抛；
2. **精确捕获**：只 catch 你**能处理**的异常类型；`catch (Exception e)` 一把梭把 OOM 也吞了属于灾难；
3. **不当流程控制**：构造异常要**抓整个调用栈**（fillInStackTrace，微秒级）——用它做 if-else 的代价是正常路径也变慢；
4. **转译带链**：底层 IOException 抛给上层前包成业务异常 `new BizException("读取配置失败", e)`——**cause 保留原始堆栈**。

**术语速查**：吞异常=catch 后无声丢弃｜抓栈=记录调用链的开销｜cause 链=异常里的异常（原始案卷）

<!--advanced-->
热点路径可用 JVM 参数 OmitStackTraceInFastThrow（JIT 熔断后 NPE 无栈——排障惊讶点）。异常表（exception table）的覆盖范围即 try 区间；异常做控制流在 8+ invoker 性能仍差两个量级于分支。预构建静态异常实例（栈在抛出点）是特殊优化。
