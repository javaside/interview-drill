---
id: 01M3KJ46DK95AVBNDQ9Z02CCAK
blockId: mysql/sql-optimization
relatedBlocks: []
question: "慢查询怎么定位？"
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 为什么优先优化总耗时最高的 SQL？
keyPoints:
  - id: kp-opt5-1
    text: "开启慢查询日志 slow_query_log，long_query_time 定阈值（如 0.1s）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt5-2
    text: "pt-query-digest 聚合慢日志：按总耗时排序找「大头 SQL」"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt5-3
    text: "对 top SQL 逐条 explain 看执行计划（type/key/rows/Extra）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt5-4
    text: "performance_schema / sys.statements_with_full_table_scans 可实时发现全表扫语句"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

定位慢 SQL 的标准流水线：

1. **开慢日志**：`slow_query_log=on`、`long_query_time=0.1`（别用默认 10s，互联网场景太粗）；也可记录全表扫描（`log_queries_not_using_indexes`）；
2. **聚合排序**：`pt-query-digest` 把日志按「指纹」归并，输出**总耗时**榜——优先打总耗时最高者（一条跑 1ms 但每秒 1 万次的 SQL，比一条跑 5s 的更值得先治）；
3. **逐条 explain**：看 type 是否 ALL、key 是否为空、rows 数量级、Extra 坏味道；
4. **实时兜底**：`sys.statements_with_full_table_scans` 等视图直接抓现行。

**术语速查**：慢日志=超阈值 SQL 的记录｜指纹=去掉参数后的 SQL 模板｜总耗时=次数×单次耗时

<!--advanced-->
优化顺序依 (总耗时=rows_examined×rta) 与锁定时间综合判断。production 常配 long_query_time=0.05~0.5 并采样；performance_schema 的 events_statements_summary_by_digest 即内存态指纹聚合，免落盘。
