---
id: 01M3M39N0Z3CVPG3JJZHS4ZAV4
blockId: java/generics
relatedBlocks: []
question: 为什么不能 new T()、new T[]？
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - 泛型方法里如何获得 T 的 Class？
keyPoints:
  - id: kp-gn3-1
    text: 擦除后 T 只是 Object/边界，编译器不知道具体类，无法实例化
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-gn3-2
    text: 绕法：传入 Class<T> 用反射 newInstance / getConstructor
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-gn3-3
    text: 数组用 Array.newInstance(cls, n)，返回强转 T[]
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-gn3-4
    text: 更优：由调用方传工厂/Supplier<T> 或直接构造具体集合
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

`T` 编译完就没了（变成 Object），运行时**不知道 T 是谁**——`new T()` 无从下手（万一 T 是抽象类呢？）。

两条绕路：

1. **传 Class<T>**：`<T> T create(Class<T> cls)` 内部 `cls.getDeclaredConstructor().newInstance()`；数组用 `Array.newInstance(cls, len)`；
2. **传工厂**：`Supplier<T>` / 函数参数 `IntFunction<T[]>`——现代 API 的常见姿势（如 `toArray(String[]::new)`）。

**术语速查**：实例化=运行时要知道具体类｜Class 对象=运行时的类型凭证｜工厂=能产出实例的函数

<!--advanced-->
Class<T> 泛型令牌在超类型令牌（TypeToken/TypeReference）场景下进一步解决「匿名子类捕获完整泛型参数」——Jackson/Guice 的基础。构造器异常与不可访问性需处理。记录组件的反射构造同样走 getRecordComponents。
