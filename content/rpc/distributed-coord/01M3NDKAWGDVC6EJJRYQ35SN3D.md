---
id: 01M3NDKAWGDVC6EJJRYQ35SN3D
blockId: rpc/distributed-coord
relatedBlocks: []
question: 雪花算法的原理和时钟回拨？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 为什么不用 UUID 当主键？
keyPoints:
  - id: kp-dc2-1
    text: 64bit=符号位0+41时间戳+10机器id+12序列——趋势递增不重不漏
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc2-2
    text: 同毫秒内序列自增，毫秒内 4096 个——溢出候下一毫秒
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc2-3
    text: 时钟回拨：机器时间倒退会撞已发号——检测到回拨拒绝/候/切换备用位
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc2-4
    text: 机器 id 分配：配置中心/DB 自增/ZK 顺序节点——防重复
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-dc2-6
    text: 趋势递增对 InnoDB 友好（自增主键同款收益：顺序写不分裂）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

**雪花 ID 的 64 位三段式**：

```
| 1bit 符号(0) | 41bit 毫秒时间戳(69年) | 10bit 机器id(1024台) | 12bit 序列(4096/毫秒) |
```

同一毫秒序列自增，跨毫秒时间戳进位——**趋势递增**（后发的号整体更大）。

两大价值：①**全局唯一且有序**——对 InnoDB 是**顺序插入**（B+ 树最右追加，不页分裂——UUID 主键的随机写是灾难，见 MySQL 自增主键卡）；②**本地生成**不依赖 DB（自增 id 的瓶颈）。

**时钟回拨**（NTP 校时把机器时间拨回）——同一毫秒再来会**撞号**：检测到回拨→小回拨（<几毫秒）**候到超过上次时间戳**再发；大回拨→**拒绝服务/切备用 workerId**/报错换机器——百度UidGenerator/美团 Leaf 的 seq 号段方案用「历史最大号持久化」绕开。

**术语速查**：三段式=时间+机器+序列｜趋势递增=整体随时间变大的有序｜回拨撞号=时间倒退重发同号

<!--advanced-->
workerId 的分配（ZK 顺序节点/DB 租约/Redis）。41bit 起始纪元自定（epoch 节省年限）。Leaf-segment：DB 号段+双 buffer 预取（无回拨问题但依赖 DB）。uuid v7 的时间有序变体。
