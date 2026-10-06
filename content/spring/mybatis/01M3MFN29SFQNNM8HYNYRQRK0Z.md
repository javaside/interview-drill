---
id: 01M3MFN29SFQNNM8HYNYRQRK0Z
blockId: spring/mybatis
relatedBlocks: []
question: MyBatis 的延迟加载原理？
cardType: atomic
appliesTo: Spring 6+
frequency: mid
followUps:
  - association 和 collection 怎么选？
keyPoints:
  - id: kp-my5-1
    text: 关联对象用代理占位（CGLIB），首次访问代理方法时才触发子查询加载
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
---

查订单时「顺带拿客户信息」不必立刻查——**延迟加载**给关联字段放一个**代理**：你调 `order.getCustomer().getName()` 的那一刻，代理才**发第二条 SQL** 把客户查回来。

原理：结果映射时关联属性不填真对象，填 **CGLIB 代理**（拦截 getter）；触发时用配置的子查询（或嵌套 resultMap 对应的 SQL）执行、替换真身。`lazyLoadingEnabled=true` 开启，`aggressiveLazyLoading` 控制「碰任一方法就全加载」。

注意：**延迟加载要求 SqlSession 还活着**（会话已关再触发=报错）；Spring 事务外直接摸懒属性是常见坑。

**术语速查**：代理占位=先欠条后兑现｜触发时机=第一次访问｜会话存活=欠条兑现的前提

<!--advanced-->
association（1:1/多对一）与 collection（1:N）的嵌套 select/nested resultMap 两形态。N+1 问题（延迟加载在循环里炸成 N 条子查询）——join 一次性映射或业务层批查替代。
