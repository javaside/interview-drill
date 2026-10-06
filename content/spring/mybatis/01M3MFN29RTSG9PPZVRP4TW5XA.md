---
id: 01M3MFN29RTSG9PPZVRP4TW5XA
blockId: spring/mybatis
relatedBlocks: []
question: MyBatis 的一二级缓存？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - 为什么 Spring 里一级缓存基本没用？
keyPoints:
  - id: kp-my2-1
    text: 一级缓存：SqlSession 级，默认开（本地 HashMap）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-my2-2
    text: 同一 SqlSession 内相同查询直接命中；insert/update/delete 或 commit 清空
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-my2-3
    text: 二级缓存：Mapper（namespace）级，需显式开启且实体可序列化
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-my2-4
    text: Spring 集成下每次请求新 SqlSession——一级缓存几乎失效
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-my2-5
    text: 分布式下二级缓存与库不一致风险——通常交给 Redis 层替代
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-my2-6
    text: localCacheScope=STATEMENT 可逐语句关闭一级缓存
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

**一级缓存（SqlSession 级）**：同一 SqlSession 里**同 SQL 同参数**直接回缓存对象；任何写操作/commit/关session **清空**。**Spring 集成的真相**：没有手动 sqlSession 的概念——**每次 Mapper 调用都开新 SqlSession**（事务内复用同一个），所以**跨请求的一级缓存基本无效**，只在同一事务内的重复查询生效（也有脏读旧值的风险，`localCacheScope=STATEMENT` 可关）。

**二级缓存（namespace 级）**：跨 SqlSession、需显式 `<cache/>` 开启 + 实体序列化。**多表关联时 namespace 隔离导致脏数据**（A 的 namespace 不知道 B 改了共享表）、分布式多实例各自为政——**生产通常关掉，缓存交给业务层 Redis**。

**术语速查**：SqlSession 级=会话内有效｜namespace 级=Mapper 内共享｜交给 Redis=缓存上移

<!--advanced-->
Transactional 下 SqlSession 由 SqlSessionHolder 与事务绑定（同事务同 session→一级缓存命中）。二级缓存的 TTL/FIFO 回收与 readOnly 提示。flushCache/useCache 的语句级开关。
