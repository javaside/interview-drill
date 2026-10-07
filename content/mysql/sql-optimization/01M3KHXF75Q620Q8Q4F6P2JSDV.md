---
id: 01M3KHXF75Q620Q8Q4F6P2JSDV
blockId: mysql/sql-optimization
relatedBlocks: []
question: 深分页 limit 1000000,10 为什么慢？怎么优化？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 为什么「记住上次位置」快？
keyPoints:
  - id: kp-opt3-1
    text: 慢因：要取出前 1000010 行再丢弃前 100 万，回表与扫描量巨大
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt3-2
    text: 游标/续传式：记住上一页末尾 id，where id > last_id limit 10
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt3-3
    text: 延迟关联：先用覆盖索引把目标主键查出来，再回表取整行
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KH6MGEVMPNVC2P2E2KZG96
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt3-4
    text: 业务侧限制跳页，只允许上一页/下一页
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

`limit 1000000, 10` 的慢是**冤枉功**：把前 1000010 行都取出来、逐行回表，然后扔掉前 100 万只留 10 行——扫描和回表全浪费了。

三种解法：

1. **续传式（最快）**：记住上一页最后一条的 id，`where id > :last_id order by id limit 10`——直接从那继续，不重复扫。
2. **延迟关联**：先在**覆盖索引**里把第 1000001~1000010 的**主键**捞出来（纯索引扫描，不回表），再拿 10 个主键回表取整行——回表从 100 万次降到 10 次。
3. **产品层规避**：搜索引擎式的跳页本就是反模式，只给「下一页」。

**术语速查**：深分页=偏移量极大的翻页｜续传=记住游标位置续读｜延迟关联=先取主键再回表

<!--advanced-->
offset 的代价 = 扫描 offset+limit 行（可能含回表）。游标式要求排序键唯一且单调（id/时间+id 双键），复杂度 O(limit)。延迟关联写法：select t.* from t join (select id from t order by x limit 1000000,10) tmp on t.id=tmp.id，子查询走 covering index 免回表。
