---
id: 01M3KHXF7554DRVCQAJDQ486AT
blockId: mysql/memory-structures
relatedBlocks: []
question: InnoDB 对传统 LRU 做了什么改进？为什么？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - young 区内部的「降温」规则是什么？
keyPoints:
  - id: kp-mem2-1
    text: 问题：全表扫描一次灌入大量冷页，把真正的热数据挤出缓存（缓存污染）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem2-2
    text: 改进：LRU 分 young/old 两代，新读入的页先进 old 区（链表 5/8 处）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem2-3
    text: 在 old 区停留超过 innodb_old_blocks_time（默认 1 秒）再次被访问才晋升 young
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem2-4
    text: 效果：扫描类冷页很快被逐出，频繁访问的热页留在 young 区不被冲刷
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KJ46DK7WT94BWAHSE3FNZB
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
  - id: kp-mem2-5
    text: young 区头部 1/4 的重复访问不再前移，减少链表抖动
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3KJ46DK7WT94BWAHSE3FNZB
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html
      locator: '15'
---

传统 LRU 一刀切：谁最近用过谁留。被**全表扫描**坑：一次 `where 无索引` 把全表页灌进链头，原本书签般常用的热页全被挤到队尾逐出——扫描完缓存白瞎了。

InnoDB 的改法——**分代**：

- 链表分 **young（热区）** 和 **old（试用区）** 两段；
- 新读入的页**插进 old 区头部**（约链表 5/8 处），不是全链头部；
- 只有在 old 区**停留超过 1 秒**（`innodb_old_blocks_time`）后再次被访问，才**晋升 young**——「被两段时间证明有用」才算真热。

效果：扫描页进 old 区转一圈（1 秒内不再被碰）就被逐出；真正反复访问的热页稳坐 young。

**术语速查**：缓存污染=冷数据冲掉热数据｜old 区=新页试用区｜晋升=试用期满再被访问才转正

<!--advanced-->
mid-point insertion 将 new sublist 与 old sublist 以 5:3 划分；old→new 的条件为第二次访问且距首次 ≥ old_blocks_time。young 区头部 1/4 内的重复访问不再前移（减少链表抖动）。该设计以一次全扫仅污染 old 区的代价，保住热点工作集。
