---
id: 01M3M39N0YNEJ902KWVMJ0XVSJ
blockId: java/generics
relatedBlocks:
  []
question: "什么是类型擦除？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 怎么证明泛型被擦除了？
keyPoints:
  - id: kp-gn1-1
    text: "编译后泛型参数被替换：无界 → Object，有界 → 边界类型"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-gn1-2
    text: "运行时 List<String> 与 List<Integer> 是同一个 Class（List.class）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-gn1-3
    text: "编译器在调用点插入 checkcast 保证取值类型正确"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-gn1-4
    text: "擦除动机：与 JDK 之前的字节码兼容（迁移兼容性决策）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

`List<String>` 和 `List<Integer>` 在**运行时是同一个类**——泛型只活在**编译期**，编译完就「洗掉」：

- 无边界 `<T>` → 编译成 **Object**；`<T extends Number>` → 编译成 **Number**；
- 你写的 `list.get(0)` 编译器自动补一句**强制转换**（checkcast）——类型安全的假象是编译器一处一处守出来的；
- 运行时反射只看得到原始类型 `List`。

验证：`new ArrayList<String>().getClass() == new ArrayList<Integer>().getClass()` 为 **true**。

**术语速查**：擦除=编译后 T 换成 Object/边界｜checkcast=编译器补的类型转换｜原始类型=擦除后的裸类

<!--advanced-->
signature 属性保留泛型信息（反射 API getGenericType 可读）供编译互操作，但 JVM 指令层无泛型。桥方法维持多态：父类擦除后的签名 vs 子类具体签名。Kotlin/C# 具化泛型可 new T[]，Java 不行（Array.newInstance 反射绕）。
