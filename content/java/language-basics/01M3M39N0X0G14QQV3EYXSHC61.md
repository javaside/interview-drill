---
id: 01M3M39N0X0G14QQV3EYXSHC61
blockId: java/language-basics
relatedBlocks:
  []
question: "重载和重写的区别？"
cardType: enumeration
appliesTo: Java 17+
frequency: high
followUps:
  - 重载方法的选取发生在什么阶段？
keyPoints:
  - id: kp-lb5-1
    text: "重写 Override：子类重新实现父类/接口的同签名方法，运行时多态"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-lb5-2
    text: "重载 Overload：同类中同名但参数列表不同的多个方法，编译期绑定"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-lb5-3
    text: "重写要求：签名相同、权限不收窄、返回类型可协变、受检异常不扩大"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-lb5-4
    text: "重载与返回类型无关；重写构成了动态分派的基础"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

**重写（Override）**——**纵向**，子类改父类：签名一模一样，实现换成自己的。调用哪个看**运行时**对象的实际类型（多态的来源：父类引用指向子类对象，调的是子类版本）。

**重载（Overload）**——**横向**，同类里排排坐：**名字相同、参数列表不同**（个数/类型/顺序）。调哪个在**编译期**就按参数静态定了，跟运行时对象类型无关。

重写的合规清单：签名相同、权限只能放宽不能收窄、返回类型相同或变子类（协变）、受检异常只能收窄。

**术语速查**：重写=子类换实现（运行时多态）｜重载=同名不同参（编译期选定）｜协变=返回类型可以变子类

<!--advanced-->
重写遵循运行时动态分派（invokevirtual/invokeinterface 按 receiver 实际类型查 vtable）；重载是编译期静态绑定（签名匹配 + 最特化规则）。桥方法由编译器生成以维持泛型/协变下的多态正确性。
