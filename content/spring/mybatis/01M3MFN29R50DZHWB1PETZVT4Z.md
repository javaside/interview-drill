---
id: 01M3MFN29R50DZHWB1PETZVT4Z
blockId: spring/mybatis
relatedBlocks:
  []
question: "Mapper 接口没有实现类，为什么能执行？"
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 方法重载在 Mapper 里能生效吗？
keyPoints:
  - id: kp-my3-1
    text: "JDK 动态代理：getMapper 返回接口的代理对象"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-my3-2
    text: "代理拦截方法调用 → 依接口全限定名+方法名定位 XML/注解里的 SQL"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-my3-3
    text: "SqlSession.selectList(namespace.method) 执行并按返回类型映射"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-my3-4
    text: "Spring 集成：MapperFactoryBean/扫描器把代理注册成 Bean"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-my3-5
    text: "@MapperScan 的 basePackages 与 annotationClass 控制扫描注册范围"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
---

Mapper 接口**没有实现类**——你调用的是 **JDK 动态代理**：

```
userMapper.findById(1)
  → MapperProxy.invoke（代理拦截）
  → 拿「接口全限定名.方法名」当 key，去 Configuration 找MappedStatement（XML 里那条 SQL）
  → SqlSession 执行 → 结果集按方法返回类型自动映射
```

**推论**：定位 SQL 靠**方法名**——**Mapper 里方法重载没有意义**（同名的两条只能匹配到一条 SQL），不同参数请取不同方法名。XML 的 namespace=接口全限定名、id=方法名，这个约定就是「绑定」。

Spring 侧：@MapperScan 触发扫描 → `MapperFactoryBean` 的 getObject 返回代理 → 注册成 Bean → @Autowired 注入的即代理。

**术语速查**：动态代理=无实现类的执行器｜namespace+id=SQL 的地址｜重载无效=同名只认一条

<!--advanced-->
MapperMethod 的方法签名解析（参数命名 @Param/arg0 编译选项）。MyBatis 3.5 的 default 方法支持（先查 MappedStatement 无则走 default）。MapperScannerConfigurer/ClassPathMapperScanner 的注册细节。
