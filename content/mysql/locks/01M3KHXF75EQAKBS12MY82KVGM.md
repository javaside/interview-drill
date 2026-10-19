---
id: 01M3KHXF75EQAKBS12MY82KVGM
blockId: mysql/locks
relatedBlocks: []
question: 记录锁、间隙锁、next-key lock 分别是什么？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - RR 和 RC 下间隙锁的行为差异？
keyPoints:
  - id: kp-lk3-1
    text: 记录锁 Record Lock：锁住单条索引记录本身
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KHXF75T0YE2NHBEJRQ9WG6
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-lk3-2
    text: 间隙锁 Gap Lock：锁住两条记录之间的开区间，阻止区间内插入新行
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M2YHWJHGBGZ57DWPS0FSTNG8
      - 01M3KHXF75T0YE2NHBEJRQ9WG6
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-lk3-3
    text: next-key lock = 记录锁 + 它前面的间隙，左开右闭区间，RR 防幻读的当前读手段
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M2YHWJHGBGZ57DWPS0FSTNG8
      - 01M3KHXF75T0YE2NHBEJRQ9WG6
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-lk3-4
    text: 唯一索引按唯一值命中时，next-key 退化为纯记录锁
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'

misconceptions:
  - id: mc-lk3-1
    text: "next-key lock 的锁定范围是左闭右开区间，例如 [10, 20)"
    why: "误解：next-key 锁的是记录加上它前面的那段缝隙，写成区间是 (10, 20]，右端记录在锁内、左端不在"
  - id: mc-lk3-2
    text: "RR 隔离级别下普通 select 也会加 next-key lock，把扫过的范围全锁住"
    why: "误解：普通查询走 MVCC 快照读一行锁都不加，只有 for update、lock in share mode 这类当前读才铺开 next-key"
  - id: mc-lk3-3
    text: "唯一索引精确命中一个已存在的值时依然要加 next-key lock，锁住该值两侧的空隙"
    why: "误解：唯一索引按唯一值精确命中会优化成纯记录锁，间隙部分被省掉，锁的范围反而收窄"
---

三种行锁，范围一个比一个大：

- **记录锁**：就锁「id=42」这一行。
- **间隙锁（gap lock）**：锁「id 在 10 和 20 之间」这段**空隙**——别人不能往缝里插新行（行本来不存在，没法锁"行"，只能锁"缝"）。
- **next-key lock**：**间隙 + 间隙右端的记录**，即 (10, 20] 这样的左开右闭区间。它是 RR 下**当前读防幻读**的主力：锁住扫描范围，新行插不进来，第二次查就不会多。

**术语速查**：记录锁=锁一行｜间隙锁=锁两行之间的缝｜next-key=缝+右端行（左开右闭）

<!--advanced-->
next-key lock 仅 RR 生效（RC 在 binlog statement 格式兼容时也用）。等值唯一索引命中时优化为 record lock；未命中时间隙锁住两邻记录之间。gap lock 之间彼此兼容（都只挡插入不挡查询），与插入意向锁冲突。
