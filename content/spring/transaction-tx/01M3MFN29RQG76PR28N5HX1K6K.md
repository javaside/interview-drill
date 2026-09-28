---
id: 01M3MFN29RQG76PR28N5HX1K6K
blockId: spring/transaction-tx
relatedBlocks:
  []
question: "编程式事务什么时候用？"
cardType: enumeration
appliesTo: Spring 6+
frequency: mid
followUps:
  - 长事务怎么治理？
keyPoints:
  - id: kp-tx4-1
    text: "粒度太细（事务包住一小段代码）或需条件分支控制提交"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-tx4-2
    text: "TransactionTemplate：回调式，无侵"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-tx4-3
    text: "PlatformTransactionManager 手动三步：getTransaction/commit/rollback"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
  - id: kp-tx4-4
    text: "声明式适合方法级边界；事务跨多方法手工编排时编程式更直白"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
---

**声明式**（@Transactional）适合「**一个方法=一个事务**」的规整边界；这些场景**编程式**更合适：

- 事务只该包方法里**一小段**（包整个方法会把 RPC/慢操作圈进来——**长事务**的常见来源）；
- 需要**按条件**决定提交/回滚的精细控制。

两种写法：**TransactionTemplate**（`execute(status -> {...})` 回调，推荐——免手误漏 rollback）；或直接拿 **PlatformTransactionManager** 三板斧（getTransaction→commit→rollback，必须 try-finally）。

**长事务治理**：事务里挪出 RPC/文件 IO/睡眠；查询别开事务（readonly 也占连接）；大批量分批提交。事务持有的是**数据库连接**——长事务=长时间占连接=连接池耗尽。

**术语速查**：模板式=回调包住事务段｜手动三步=get/commit/rollback｜长事务=占着连接不放

<!--advanced-->
TransactionTemplate 的 propagation/isolation/readonly 可编程配置（每次 execute 用当次配置）。TransactionSynchronization 的 beforeCommit/afterCommit 钩子适合「事务提交后发消息」的最终一致性（RocketMQ 事务消息的本地对偶）。
