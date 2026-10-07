---
id: 01M3KJ46DKRAYACW2N5KTJ7K2G
blockId: mysql/binlog
relatedBlocks: []
question: GTID 是什么？解决了什么问题？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - GTID 模式下搭建从库参数是什么？
keyPoints:
  - id: kp-bi4-1
    text: 全局事务标识 server_uuid:transaction_id，每个事务在集群内唯一
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZ2YRJHBP2A6CJ4W7R
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi4-2
    text: 旧方式主从对位靠「文件名+偏移量」，手工易错；GTID 自动对位
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi4-3
    text: 从库自动跳过已执行过的 GTID，故障切换与新从库搭建简单
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZ2YRJHBP2A6CJ4W7R
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-bi4-4
    text: 可对比主从的 GTID 集合判断是否一致（Retrieved/Executed set）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

老式复制像「磁带对位」：从库要记「我在主库的 mysql-bin.000003 文件的第 812 字节」——文件名+偏移，手工指定，错了就乱。

**GTID** 给每个事务发一张**全局身份证**：`server_uuid:序号`（如 `3E11FA47-...:42`）。

好处：

- 从库**自动**知道该拉哪些（没执行过的 GTID 集合），不用人工报坐标；
- 主从**对账**容易：比两边的 GTID 集合，缺哪些一目了然；
- 故障切换、新加从库的配置大幅简化。

**术语速查**：GTID=事务的全局身份证｜GTID 集合=某实例已执行的事务清单

<!--advanced-->
开启 gtid_mode=on+enforce_gtid_consistency。CHANGE REPLICATION SOURCE TO ... SOURCE_AUTO_POSITION=1 即自动对位。GTID 限制：同一事务不能跨库更新非事务表等约束以保证标识唯一。
