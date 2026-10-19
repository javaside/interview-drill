---
id: 01M3KJ46DK95AVBNDQ9Z02CCAK
blockId: mysql/sql-optimization
relatedBlocks: []
question: 慢查询怎么定位？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - 为什么优先优化总耗时最高的 SQL？
keyPoints:
  - id: kp-opt5-1
    text: 开启慢查询日志 slow_query_log，long_query_time 定阈值（如 0.1s）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt5-2
    text: pt-query-digest 聚合慢日志：按总耗时排序找「大头 SQL」
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt5-3
    text: 对 top SQL 逐条 explain 看执行计划（type/key/rows/Extra）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF750A1FEDHQBMPJ60VW
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-opt5-4
    text: performance_schema / sys.statements_with_full_table_scans 可实时发现全表扫语句
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
misconceptions:
  - id: mc-opt5-1
    text: "慢查询日志装好 MySQL 就默认开启，直接翻日志就能找到慢 SQL"
    why: "误解：slow_query_log 出厂默认关闭，要先打开它并设好 long_query_time 阈值才有记录"
  - id: mc-opt5-2
    text: "慢查询日志只收录 select，update、delete 再慢也不会被记进去"
    why: "误解：慢日志按耗时收录语句，增删改与 DDL 只要超过阈值同样入册，并非查询专属"
  - id: mc-opt5-3
    text: "show processlist 沉淀了历史慢 SQL，可以拿来替代慢日志做离线分析"
    why: "误解：processlist 只展示此刻正在执行的语句快照，看完即散，历史统计还得依赖慢查询日志"
---

定位慢 SQL 的标准流水线：

1. **开慢日志**：`slow_query_log=on`、`long_query_time=0.1`（别用默认 10s，互联网场景太粗）；也可记录全表扫描（`log_queries_not_using_indexes`）；
2. **聚合排序**：`pt-query-digest` 把日志按「指纹」归并，输出**总耗时**榜——优先打总耗时最高者（一条跑 1ms 但每秒 1 万次的 SQL，比一条跑 5s 的更值得先治）；
3. **逐条 explain**：看 type 是否 ALL、key 是否为空、rows 数量级、Extra 坏味道；
4. **实时兜底**：`sys.statements_with_full_table_scans` 等视图直接抓现行。

**术语速查**：慢日志=超阈值 SQL 的记录｜指纹=去掉参数后的 SQL 模板｜总耗时=次数×单次耗时

<!--advanced-->
优化顺序依 (总耗时=rows_examined×rta) 与锁定时间综合判断。production 常配 long_query_time=0.05~0.5 并采样；performance_schema 的 events_statements_summary_by_digest 即内存态指纹聚合，免落盘。
