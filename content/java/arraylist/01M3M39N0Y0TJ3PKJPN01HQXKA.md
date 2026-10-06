---
id: 01M3M39N0Y0TJ3PKJPN01HQXKA
blockId: java/arraylist
relatedBlocks: []
question: subList 返回的是什么？
cardType: atomic
appliesTo: Java 17+
frequency: mid
followUps:
  - 视图失效是什么错？
keyPoints:
  - id: kp-al3-1
    text: 原列表的一个视图：不拷贝数据，视图上的结构修改直接作用于原列表
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

`list.subList(2, 5)` 拿到的**不是新列表，是原列表的「窗口」**（视图）：底层同一份数据，**不拷贝**。

- 视图上的**结构性修改（增删）会直接打到原列表**；
- 原列表此后被**结构性修改**，视图立刻作废——再碰它就是 `ConcurrentModificationException`（视图失效）。

**术语速查**：视图=指向原数据的窗口｜结构修改=动了元素个数｜视图失效=原列表变了视图作废

<!--advanced-->
SubList 持有 parent 引用与 offset/size；modCount 对账与 fail-fast 同源。JDK 指南：subList 结果只作临时遍历/局部操作，需持久化就 new ArrayList<>(subList) 拷贝快照。
