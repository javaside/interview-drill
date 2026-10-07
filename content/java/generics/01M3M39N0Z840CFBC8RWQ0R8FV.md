---
id: 01M3M39N0Z840CFBC8RWQ0R8FV
blockId: java/generics
relatedBlocks: []
question: 什么是桥方法？
cardType: enumeration
appliesTo: Java 17+
frequency: low
followUps:
  - 什么时候能在反编译里看到它？
keyPoints:
  - id: kp-gn5-1
    text: 编译器为擦除后多态生成的合成转发方法（synthetic bridge）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0YNEJ902KWVMJ0XVSJ
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-gn5-2
    text: 反射按名字找方法时需过滤 isBridge 避免重复命中
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-gn5-3
    text: 父类引用调用落在桥上，桥强转参数后转调擦除前的具体版本
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

你写 `class MyComp implements Comparator<String>` 并重写 compare——擦除让签名**对不上**，多态要炸。编译器默默补一个**桥方法**（synthetic bridge）：

```java
// 接口里声明的：       int compare(T o1, T o2)        // T 是泛型参数
// 擦除后接口里实际的： int compare(Object o1, Object o2)
// 你写的实现：         int compare(String a, String b) // T 落地为 String——签名对不上
// 编译器补的桥：       int compare(Object a, Object b) { return compare((String)a, (String)b); }
```

父类引用调 `compare(Object,Object)` 时落在桥上，桥里强转后转调你的具体版本——**擦除世界的多态胶水**。反射遍历方法列表（带 synthetic/bridge 标记）能看到它。

**术语速查**：合成方法=编译器生成非人写｜桥=转发维持多态｜synthetic 标记=反射可识别

<!--advanced-->
桥同样出现在协变返回类型（父返回 Object 子返回 String）。AnnotationTypeMismatch 与 @Override 对桥的匹配规则由编译器特判。AOP/反射按名字找方法时要过滤 bridge，否则重复触发。
