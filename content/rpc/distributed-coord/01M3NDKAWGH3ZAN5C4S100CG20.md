---
id: 01M3NDKAWGH3ZAN5C4S100CG20
blockId: rpc/distributed-coord
relatedBlocks: []
question: 分布式锁的三种实现与取舍？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - Redis 锁的看门狗是什么？
keyPoints:
  - id: kp-dc3-1
    text: DB 唯一键/乐观锁：简单慢——低频够用
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc3-2
    text: Redis SETNX+过期+Lua 释放：性能高；但主从切换丢锁（Redlock 争议）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc3-3
    text: ZK 临时顺序节点+watch 前驱：可靠无惊群——一致性场景首选
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc3-4
    text: 看家三件：互斥/无死锁（超时兜底）/容错（锁服务挂了怎么办）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNS6E8G0K2M4N6Q8S1V
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc3-5
    text: 谨慎长锁：锁内做事要短，业务级防重才是根本
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

**三种锁实现按「快/稳/简」取舍**：

- **DB 锁**（unique key / `update ... where version=x`）：最简单、最慢——**低频后台任务**够用；
- **Redis 锁**：`SET key value NX EX 10`——**快**；三个坑：①过期了业务没跑完（别人拿到锁）→ **看门狗**（定时续期，Redisson watchdog）；②释放别人的锁（超时后）→ value 存随机串+**Lua 校验再删**；③主从切换新主没锁数据 → 主从**异步复制丢锁**（Redlock 多数派尝试补救——争议大，多数场景接受小概率）；④不可重入需自己实现（Redisson 可重入锁）；
- **ZK 锁**：**临时顺序节点**，序号最小者持锁，其余 watch 前驱——**无惊群、会话断自动释放（无死锁）**——可靠但吞吐低于 Redis。

**根本提醒**：锁只是**防线之一**——**幂等才是兜底**（锁失效时的最后保险）。

**术语速查**：看门狗=自动续期防业务超时｜Lua 校验=删自己的锁不删别人的｜顺序节点=排队取锁无惊群

<!--advanced-->
Redlock 的争论（Kleppmann vs antirez：时钟假设/fencing token）。fencing token（锁带递增令牌，资源方拒绝旧令牌）。ZK 的羊群效应与顺序节点 watch 前驱的解法。
