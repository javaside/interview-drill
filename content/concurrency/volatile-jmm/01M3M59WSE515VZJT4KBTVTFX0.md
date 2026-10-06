---
id: 01M3M59WSE515VZJT4KBTVTFX0
blockId: concurrency/volatile-jmm
relatedBlocks: []
question: 什么是双重检查锁定（DCL）？为什么要 volatile？
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 静态内部类单例为什么不需要 volatile？
keyPoints:
  - id: kp-vj4-1
    text: 两次判空 + 锁：外层免锁快路径，内层加锁防重复创建
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj4-2
    text: 隐患：new 分配→构造→赋值给引用 可被重排为 先赋值后构造
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj4-3
    text: 无 volatile 时另一线程拿到非 null 的半成品引用
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
  - id: kp-vj4-4
    text: JDK5 后 volatile 语义补全，DCL 才真正可靠；更简替代是静态内部类 HOLDER 模式
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/package-summary.html
      locator: java.util.concurrent
---

懒加载单例的经典写法——**判两次、锁一次**：

```java
if (instance == null)                    // ① 没实例才往下（快路径免锁）
  synchronized (K.class) {
    if (instance == null)                // ② 进锁再核一次（防两线程同过①）
      instance = new K();                // ③ 危险的一行
  }
```

③ 这行是三步：分配内存 → **构造** → 引用赋值。**构造与赋值可能被重排**（先赋值、对象还没构造完）——线程 B 在 ① 看到 non-null 就用，拿到**半成品**。`instance` 加 **volatile**（禁重排 + 可见）才堵死这条路。

更省心的替代：**静态内部类 HOLDER**（类加载机制天然线程安全+懒加载）或 enum。

**术语速查**：快路径=无锁判断｜半成品=引用已出构造未完｜HOLD ER 模式=借类加载的线程安全

<!--advanced-->
JDK5 前的 volatile 缺 HB 语义致 DCL 无法修复（JSR-133 补全）。HOLD ER 依赖「类初始化锁」（<clinit> 的 CLH）：JVM 保证静态初始化线程安全且对外发布具 HB。枚举单例=类初始化+防反射/防序列化三重福利。DCL 对 int/基本类型亦有效但对象场景才经典。
