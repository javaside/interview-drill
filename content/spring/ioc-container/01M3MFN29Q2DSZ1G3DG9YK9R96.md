---
id: 01M3MFN29Q2DSZ1G3DG9YK9R96
blockId: spring/ioc-container
relatedBlocks: []
question: 三种依赖注入方式怎么选？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 为什么官方推荐构造器注入？
keyPoints:
  - id: kp-ioc2-1
    text: 构造器注入：强制依赖、不可变（final）、官方推荐
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ioc2-2
    text: Setter 注入：可选依赖、可重配置的场景
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ioc2-3
    text: 字段注入（@Autowired 在字段上）：最简但隐式依赖、测试难、IDE 都警告
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-ioc2-4
    text: 循环依赖时构造器注入直接失败——Setter/字段可被三级缓存救
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3MFN29RF62WP8ZD6T4TYK8H
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
misconceptions:
  - id: mc-ioc2-1
    text: "@Autowired 默认按名称匹配，找不到同名 Bean 再退回按类型"
    why: "误解：@Autowired 先按类型收窄，同类型多候选才用 @Qualifier/@Primary 分流；先按名称走的是 @Resource"
  - id: mc-ioc2-2
    text: "构造器注入配合不了 final 字段，想不可变只能靠字段注入再加私有 setter"
    why: "误解：构造器正是给 final 字段赋值的地方——构造注入加 final 才是官方推荐的不可变写法"
  - id: mc-ioc2-3
    text: "Setter 注入是官方推荐的默认方式，因为它灵活还能中途换依赖"
    why: "误解：官方默认推荐构造器注入（强制依赖、不可变、依赖显式）；Setter 只留给可选或可重配置的依赖"
---

按**依赖的刚性**选：

- **构造器注入**（官方推荐）：依赖是**必需品**——不给就没法造对象。字段可 **final**（不可变）、依赖一眼全在构造参数上（强迫你想清楚职责）、**单测 new 即测**（不用容器）；
- **Setter 注入**：依赖是**可选**的或**可中途换**的（配置刷新）；
- **字段注入**（`@Autowired` 直接怼字段）：代码最少，但**依赖藏起来**了（测试要靠容器/反射）、没法 final、循环依赖最隐蔽——**IDE 和官方都不建议**，大量存量代码的历史习惯。

**术语速查**：强制依赖=没有它不成立｜不可变=final 锁死｜隐式依赖=看类声明看不出要什么

<!--advanced-->
Spring 4.3 起单构造器免 @Autowired。Lombok @RequiredArgsConstructor + final 字段是最优雅组合。@Qualifier/Primary 解多候选。循环依赖：构造器注入直接 BeanCurrentlyInCreationException（见循环依赖块）。
