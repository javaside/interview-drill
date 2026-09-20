---
id: 01M2YHWH5R70FFC6TGAN0VP7ZS
blockId: mysql/mvcc-undo
relatedBlocks: []
question: InnoDB 的 undo log 有哪些作用？
cardType: enumeration
appliesTo: MySQL 8.0+
frequency: high
followUps:
  - undo log 本身也要写 redo log 吗？为什么？
  - 一个事务的 undo log 什么时候可以被清理？
keyPoints:
  - id: kp-0vp7zs-1
    text: 事务回滚：记录修改前的旧值，回滚时逆向应用还原数据
    public: true
    verifiedAt: 2026-09-20
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-undo-logs.html
      locator: 15.6.3.4
  - id: kp-0vp7zs-2
    text: 为 MVCC 快照读构造旧版本，供 ReadView 读取可见的历史行
    public: false
    verifiedAt: 2026-09-20
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-multi-versioning.html
      locator: "15.3"
  - id: kp-0vp7zs-3
    text: 崩溃恢复中回滚重启时仍未提交的事务
    public: false
    verifiedAt: 2026-09-20
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-recovery.html
      locator: 15.18.2
  - id: kp-0vp7zs-4
    text: 区分两类：insert undo 提交后即可丢弃，update undo 需留给 MVCC
    public: false
    verifiedAt: 2026-09-20
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: source-code
      url: https://github.com/mysql/mysql-server/blob/8.0/storage/innobase/include/trx0undo.h
      locator: TRX_UNDO_INSERT / TRX_UNDO_UPDATE
  - id: kp-0vp7zs-5
    text: 同一行的多个旧版本靠 roll_pointer 串成版本链
    public: false
    verifiedAt: 2026-09-20
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://dev.mysql.com/doc/refman/8.0/en/innodb-multi-versioning.html
      locator: '15.3'
---

InnoDB 的 undo log 是事务原子性和 MVCC 的共同基础。它记录每次修改的前像（旧值），
既能在事务回滚或崩溃恢复时把数据还原，也能为快照读提供行的历史版本。

insert 产生的 undo（insert undo）因为旧版本不存在，事务一提交就可以丢弃；
update/delete 产生的 undo（update undo）则必须保留到没有任何 ReadView 可能再读到
它为止，由后台 purge 线程负责清理。同一行历史版本通过每条记录里的 roll_pointer
指向前一版本，形成一条版本链，MVCC 沿链找到对当前 ReadView 可见的那一版。
